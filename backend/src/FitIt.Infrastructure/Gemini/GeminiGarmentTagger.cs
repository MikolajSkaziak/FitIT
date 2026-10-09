using System.Text.Json;
using System.Text.Json.Nodes;
using FitIt.Core.Common;
using FitIt.Core.Wardrobe;
using static FitIt.Infrastructure.Gemini.GeminiJson;

namespace FitIt.Infrastructure.Gemini;

/// <summary>
/// Describes a garment from its cutout (product spec 5.2 and 5.3). The answer is held to the app's closed lists twice: the
/// response schema names every allowed code, and whatever comes back is parsed code by code. Anything outside the lists is a
/// <see cref="ProviderException"/>, which the job retries and, in the end, turns into "fill the tags in by hand": the garment stays.
/// A photo the safety filter refuses is treated the same way, never as a reason to throw the garment out.
/// </summary>
public sealed class GeminiGarmentTagger(GeminiClient gemini, IImageStorage storage) : IGarmentTagger
{
    private const string Garment = "garment";

    private static readonly JsonObject Schema = GeminiJson.Object(
        ("verdict", OneOf([Garment, .. EnumCodes.All<RejectReason>()])),
        ("subcategory", OneOf(EnumCodes.All<Subcategory>())),
        ("name", Text()),
        ("colors", List(OneOf(EnumCodes.All<Color>()))),
        ("pattern", OneOf(EnumCodes.All<Pattern>())),
        ("material", OneOf(EnumCodes.All<Material>())),
        ("formality", Whole()),
        ("warmth", Whole()),
        ("rain_ok", Flag()),
        ("styles", List(OneOf(EnumCodes.All<StyleTag>()))),
        ("seasons", List(OneOf(EnumCodes.All<Season>()))),
        ("description", Text()));

    public async Task<TaggingOutcome> TagAsync(ImageSource cutout, CancellationToken cancellationToken)
    {
        var picture = await storage.ReadAsync(cutout.Key, null, cancellationToken);
        var reply = await gemini.AskAsync(GeminiPrompts.Tagger, [GeminiPart.Of(picture), GeminiPart.Of("Describe the garment in this picture.")], Schema, cancellationToken);
        if (reply.Blocked)
        {
            throw new ProviderException("The tagger's safety filter refused the picture.") { Cost = reply.Cost };
        }

        return Parse(reply.Json, reply.Cost);
    }

    internal static TaggingOutcome Parse(JsonElement json, AiCost cost)
    {
        ProviderException Unfit(string what) => new($"The tagger's answer does not fit the dictionaries ({what}).") { Cost = cost };

        var verdict = Str(json, "verdict");
        if (verdict != Garment)
        {
            return EnumCodes.TryParse<RejectReason>(verdict, out var reason) ? TaggingOutcome.Refused(reason, cost) : throw Unfit("verdict");
        }

        T One<T>(string name) where T : struct, Enum => EnumCodes.TryParse<T>(Str(json, name), out var value) ? value : throw Unfit(name);

        List<T> Many<T>(string name) where T : struct, Enum =>
            [.. Items(json, name).Select(item => item.ValueKind == JsonValueKind.String && EnumCodes.TryParse<T>(item.GetString(), out var value) ? value : throw Unfit(name)).Distinct()];

        var subcategory = One<Subcategory>("subcategory");
        var name = Line(Str(json, "name"), GarmentTags.NameMaxLength) ?? throw Unfit("name");
        var tags = new GarmentTags(
            GarmentCatalog.CategoryOf(subcategory),
            subcategory,
            name,
            Many<Color>("colors"),
            One<Pattern>("pattern"),
            One<Material>("material"),
            Int(json, "formality") ?? throw Unfit("formality"),
            Int(json, "warmth") ?? throw Unfit("warmth"),
            Bool(json, "rain_ok") ?? throw Unfit("rain_ok"),
            Many<StyleTag>("styles"),
            Many<Season>("seasons"));
        if (tags.Check() is { } error)
        {
            throw Unfit(error.Code);
        }

        // The sentence is read by the stylist and the image model later on, so it is kept to one plain line; without one the tags describe the garment.
        return TaggingOutcome.Accepted(tags, Line(Str(json, "description"), ClothingItem.DescriptionMaxLength) ?? tags.Describe(), cost);
    }
}
