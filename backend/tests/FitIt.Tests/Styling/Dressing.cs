using System.Text.Json.Nodes;
using FitIt.Api.Contracts;
using FitIt.Core.Wardrobe;
using FitIt.Tests.Support;

namespace FitIt.Tests.Styling;

/// <summary>Wardrobes and requests for the stylist's integration tests.</summary>
internal static class Dressing
{
    public static readonly GarmentTags Tee = new(Category.Top, Subcategory.TShirt, "White T-shirt", [Color.White], Pattern.Plain, Material.Cotton, 2, 1, false, [StyleTag.Casual]);
    public static readonly GarmentTags Shirt = new(Category.Top, Subcategory.Shirt, "Light blue shirt", [Color.LightBlue], Pattern.Plain, Material.Cotton, 3, 2, false, [StyleTag.Smart, StyleTag.Casual]);
    public static readonly GarmentTags Sweater = new(Category.MidLayer, Subcategory.Sweater, "Cream sweater", [Color.Cream], Pattern.Plain, Material.Knit, 2, 3, false, [StyleTag.Casual]);
    public static readonly GarmentTags Jeans = new(Category.Bottom, Subcategory.Jeans, "Blue jeans", [Color.Blue], Pattern.Plain, Material.Denim, 2, 3, false, [StyleTag.Casual]);
    public static readonly GarmentTags Chinos = new(Category.Bottom, Subcategory.Chinos, "Beige chinos", [Color.Beige], Pattern.Plain, Material.Cotton, 3, 2, false, [StyleTag.Smart, StyleTag.Casual]);
    public static readonly GarmentTags Sneakers = new(Category.Shoes, Subcategory.Sneakers, "White sneakers", [Color.White], Pattern.Plain, Material.Leather, 2, 2, false, [StyleTag.Casual]);
    public static readonly GarmentTags Boots = new(Category.Shoes, Subcategory.Boots, "Brown ankle boots", [Color.Brown], Pattern.Plain, Material.Leather, 3, 3, true, [StyleTag.Casual, StyleTag.Smart]);
    public static readonly GarmentTags Jacket = new(Category.Outerwear, Subcategory.Jacket, "Black jacket", [Color.Black], Pattern.Plain, Material.Synthetic, 2, 3, false, [StyleTag.Casual]);
    public static readonly GarmentTags Raincoat = new(Category.Outerwear, Subcategory.Raincoat, "Navy raincoat", [Color.Navy], Pattern.Plain, Material.Synthetic, 2, 2, true, [StyleTag.Casual]);
    public static readonly GarmentTags Belt = new(Category.Accessory, Subcategory.Belt, "Brown belt", [Color.Brown], Pattern.Plain, Material.Leather, 3, 2, false, [StyleTag.Casual]);
    public static readonly GarmentTags Slippers = new(Category.Shoes, Subcategory.Sneakers, "Gray sneakers", [Color.Grey], Pattern.Plain, Material.Cotton, 1, 2, false, [StyleTag.Casual]);

    /// <summary>Two tops, two bottoms, two pairs of shoes, a sweater, a jacket and a belt: enough for three different outfits on a warm day.</summary>
    public static readonly GarmentTags[] Basics = [Tee, Shirt, Sweater, Jeans, Chinos, Sneakers, Boots, Jacket, Belt];

    /// <summary>Adds a garment that the tagger describes exactly as given, and runs its processing.</summary>
    public static async Task<ClothingResponse> AddTaggedGarmentAsync(this ApiFactory factory, HttpClient client, GarmentTags tags)
    {
        factory.Ai.TaggingReturns(tags);
        return await factory.AddProcessedGarmentAsync(client);
    }

    public static async Task<List<ClothingResponse>> DressAsync(this ApiFactory factory, HttpClient client, params GarmentTags[] wardrobe)
    {
        var added = new List<ClothingResponse>();
        foreach (var tags in wardrobe)
        {
            added.Add(await factory.AddTaggedGarmentAsync(client, tags));
        }

        return added;
    }

    /// <summary>A signed-in person with consent and the given wardrobe, on a day that feels the same all day long.</summary>
    public static async Task<(HttpClient Client, AuthResponse Auth, List<ClothingResponse> Wardrobe)> DressedAsync(
        this ApiFactory factory, double feels, GarmentTags[] wardrobe, bool rain = false)
    {
        factory.Ai.Reset();
        factory.Stylist.Reset();
        var weather = factory.FreshWeather();
        (weather.Low, weather.High, weather.RainProbability) = (feels, feels, rain ? 80 : 10);
        var (client, auth) = await factory.SignedInWithConsentAsync();
        return (client, auth, await factory.DressAsync(client, wardrobe));
    }

    public static Task<HttpResponseMessage> SuggestAsync(this HttpClient client, string occasion = "everyday", string? note = null, Guid? baseItemId = null)
    {
        var body = new JsonObject { ["occasion"] = occasion };
        if (note is not null)
        {
            body["note"] = note;
        }

        if (baseItemId is { } id)
        {
            body["baseItemId"] = id.ToString();
        }

        return client.PostJsonAsync("/api/outfits/suggestions", body);
    }

    public static async Task<SuggestionsResponse> SuggestedAsync(this HttpClient client, string occasion = "everyday", string? note = null, Guid? baseItemId = null)
    {
        var response = await client.SuggestAsync(occasion, note, baseItemId);
        Assert.Equal(System.Net.HttpStatusCode.OK, response.StatusCode);
        return await response.ReadAsync<SuggestionsResponse>();
    }

    public static Task<HttpResponseMessage> TodayAsync(this HttpClient client, string occasion = "everyday", bool fresh = false) =>
        client.PostJsonAsync("/api/outfits/suggestions/today", new JsonObject { ["occasion"] = occasion, ["fresh"] = fresh });

    public static async Task<SuggestionsResponse> TodaysAsync(this HttpClient client, string occasion = "everyday", bool fresh = false)
    {
        var response = await client.TodayAsync(occasion, fresh);
        Assert.Equal(System.Net.HttpStatusCode.OK, response.StatusCode);
        return await response.ReadAsync<SuggestionsResponse>();
    }

    public const double Warm = 20;
    public const double Cold = 6;
}
