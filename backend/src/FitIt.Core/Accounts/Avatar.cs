namespace FitIt.Core.Accounts;

/// <summary>A ready-made silhouette the outfit is shown on. Public, not personal data (product spec 7.3).</summary>
public sealed class Avatar
{
    public Guid Id { get; set; }

    /// <summary>The set the picture belongs to: <see cref="Accounts.Gender.Female"/> or <see cref="Accounts.Gender.Male"/>. Never one of the two open values.</summary>
    public Gender Gender { get; set; }

    /// <summary>Stable code of the body type within a gender, for example <c>hourglass</c>.</summary>
    public required string BodyType { get; set; }

    /// <summary>English name shown under the picture, for example "Hourglass".</summary>
    public required string Label { get; set; }

    /// <summary>Path of the 3:4 picture under the API's static files.</summary>
    public required string ImagePath { get; set; }

    public required string ThumbPath { get; set; }

    /// <summary>The same silhouette as a whole figure on a transparent background, 3:4: what the app lays an outfit's garments over.</summary>
    public string FigurePath => $"/avatars/figure/{Path.GetFileNameWithoutExtension(ImagePath)}.png";

    public int SortOrder { get; set; }

    public bool IsActive { get; set; } = true;
}

/// <summary>
/// The ten silhouettes seeded at startup. Ids are fixed so that a restart updates rows instead of duplicating them.
/// The pictures are placeholders cut from the author's reference image until the final renders exist.
/// </summary>
public static class AvatarCatalog
{
    public static IReadOnlyList<Avatar> All { get; } =
    [
        Make("0f1c0a10-0000-4000-8000-000000000001", Gender.Female, "hourglass", "Hourglass", "k-klepsydra", 1),
        Make("0f1c0a10-0000-4000-8000-000000000002", Gender.Female, "pear", "Pear", "k-gruszka", 2),
        Make("0f1c0a10-0000-4000-8000-000000000003", Gender.Female, "apple", "Apple", "k-jablko", 3),
        Make("0f1c0a10-0000-4000-8000-000000000004", Gender.Female, "column", "Column", "k-kolumna", 4),
        Make("0f1c0a10-0000-4000-8000-000000000005", Gender.Female, "goblet", "Goblet", "k-kielich", 5),
        Make("0f1c0a10-0000-4000-8000-000000000011", Gender.Male, "triangle", "Triangle", "m-trojkat", 1),
        Make("0f1c0a10-0000-4000-8000-000000000012", Gender.Male, "inverted_triangle", "Inverted triangle", "m-odwrocony-trojkat", 2),
        Make("0f1c0a10-0000-4000-8000-000000000013", Gender.Male, "rectangle", "Rectangle", "m-prostokat", 3),
        Make("0f1c0a10-0000-4000-8000-000000000014", Gender.Male, "oval", "Oval", "m-owal", 4),
        Make("0f1c0a10-0000-4000-8000-000000000015", Gender.Male, "trapezoid", "Trapezoid", "m-trapez", 5),
    ];

    private static Avatar Make(string id, Gender gender, string bodyType, string label, string file, int order) => new()
    {
        Id = Guid.Parse(id),
        Gender = gender,
        BodyType = bodyType,
        Label = label,
        ImagePath = $"/avatars/{file}.jpg",
        ThumbPath = $"/avatars/{file}.jpg",
        SortOrder = order,
        IsActive = true,
    };
}
