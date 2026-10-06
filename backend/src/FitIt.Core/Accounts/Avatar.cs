namespace FitIt.Core.Accounts;

/// <summary>A ready-made silhouette the outfit is shown on. Public, not personal data (product spec 7.3).</summary>
public sealed class Avatar
{
    public Guid Id { get; set; }

    public Gender Gender { get; set; }

    /// <summary>Stable code of the body type within a gender, for example <c>hourglass</c>.</summary>
    public required string BodyType { get; set; }

    /// <summary>Polish name shown under the picture, for example "Klepsydra".</summary>
    public required string Label { get; set; }

    /// <summary>Path of the 3:4 picture under the API's static files.</summary>
    public required string ImagePath { get; set; }

    public required string ThumbPath { get; set; }

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
        Make("0f1c0a10-0000-4000-8000-000000000001", Gender.Female, "hourglass", "Klepsydra", "k-klepsydra", 1),
        Make("0f1c0a10-0000-4000-8000-000000000002", Gender.Female, "pear", "Gruszka", "k-gruszka", 2),
        Make("0f1c0a10-0000-4000-8000-000000000003", Gender.Female, "apple", "Jabłko", "k-jablko", 3),
        Make("0f1c0a10-0000-4000-8000-000000000004", Gender.Female, "column", "Kolumna", "k-kolumna", 4),
        Make("0f1c0a10-0000-4000-8000-000000000005", Gender.Female, "goblet", "Kielich", "k-kielich", 5),
        Make("0f1c0a10-0000-4000-8000-000000000011", Gender.Male, "triangle", "Trójkąt", "m-trojkat", 1),
        Make("0f1c0a10-0000-4000-8000-000000000012", Gender.Male, "inverted_triangle", "Odwrócony trójkąt", "m-odwrocony-trojkat", 2),
        Make("0f1c0a10-0000-4000-8000-000000000013", Gender.Male, "rectangle", "Prostokąt", "m-prostokat", 3),
        Make("0f1c0a10-0000-4000-8000-000000000014", Gender.Male, "oval", "Owal", "m-owal", 4),
        Make("0f1c0a10-0000-4000-8000-000000000015", Gender.Male, "trapezoid", "Trapez", "m-trapez", 5),
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
