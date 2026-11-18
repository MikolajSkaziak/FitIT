using System.ComponentModel.DataAnnotations;
using FitIt.Core.Styling;
using FitIt.Core.Wardrobe;

namespace FitIt.Api.Contracts;

/// <summary>One line of the conversation: who said it and what. The text has 1 to 1000 characters once trimmed.</summary>
public sealed class StylistChatMessage
{
    [Required]
    public ChatRole? Role { get; init; }

    [Required]
    public string? Text { get; init; }
}

/// <summary>
/// A message to the person's stylist with the recent conversation: 1 to 16 lines, oldest first, the last one the person's.
/// Nothing of it is stored; send the conversation again with every message. <c>Occasion</c> is the occasion the person picked
/// in the app, if any. <c>Date</c> is the day of the person's calendar the conversation is about, today or one of the next six;
/// left out, it is today.
/// </summary>
public sealed class StylistChatRequest : IValidatableObject
{
    [Required]
    [MinLength(1)]
    [MaxLength(StylistChatCase.MaxMessages)]
    public List<StylistChatMessage>? Messages { get; init; }

    public Occasion? Occasion { get; init; }

    public DateOnly? Date { get; init; }

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (Messages is not { Count: > 0 } messages)
        {
            yield break;
        }

        for (var index = 0; index < messages.Count; index++)
        {
            if (messages[index]?.Text?.Trim() is { Length: > StylistChatCase.MessageMaxLength })
            {
                yield return new ValidationResult(
                    $"A message may have at most {StylistChatCase.MessageMaxLength} characters.", [$"{nameof(Messages)}[{index}].{nameof(StylistChatMessage.Text)}"]);
            }
        }

        if (messages[^1]?.Role is { } last && last != ChatRole.Person)
        {
            yield return new ValidationResult("The last message must be the person's.", [nameof(Messages)]);
        }
    }
}

/// <summary>An outfit the stylist put together from the person's garments: the same <c>Items</c> as an outfit's, and why it works in <c>Note</c>.</summary>
public sealed record StylistOutfitResponse(Occasion Occasion, IReadOnlyList<OutfitItemResponse> Items, string? Note);

/// <summary>A generic piece to buy: never a brand, a link or a price. <c>Why</c> says what it unlocks with what the person owns; <c>Colors</c> are wardrobe colour codes.</summary>
public sealed record ShoppingSuggestionResponse(string Name, Category Category, string Why, IReadOnlyList<Color> Colors);

/// <summary><c>ai</c> when the model wrote the reply, <c>rules</c> when the app's own rules did.</summary>
public enum StylistReplySource
{
    Ai,
    Rules,
}

/// <summary>
/// The stylist's reply. <c>Text</c> is plain text in short paragraphs, possibly with lines that start with "- ".
/// <c>Outfit</c> is null unless the reply puts one together. <c>Mentioned</c> are up to six of the person's garments the
/// text talks about, in the order it mentions them. <c>Shopping</c> holds up to three pieces to buy, <c>FollowUps</c> up to
/// three questions the person could tap next, in their own voice.
/// </summary>
public sealed record StylistReplyResponse(
    string Text,
    StylistOutfitResponse? Outfit,
    IReadOnlyList<ClothingResponse> Mentioned,
    IReadOnlyList<ShoppingSuggestionResponse> Shopping,
    IReadOnlyList<string> FollowUps,
    StylistReplySource Source);
