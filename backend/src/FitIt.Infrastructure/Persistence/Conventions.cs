using System.Text.Json;
using FitIt.Core.Common;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace FitIt.Infrastructure.Persistence;

/// <summary>Stores an enum as its snake case code, the same text the API uses.</summary>
internal sealed class EnumCodeConverter<T>() : ValueConverter<T, string>(
    value => EnumCodes.ToCode(value),
    code => EnumCodes.Parse<T>(code))
    where T : struct, Enum;

internal static class SnakeCaseNaming
{
    /// <summary>Renames every column, key, foreign key and index to snake case. Table names are set explicitly per entity.</summary>
    public static void UseSnakeCaseNames(this ModelBuilder builder)
    {
        foreach (var entity in builder.Model.GetEntityTypes())
        {
            foreach (var property in entity.GetProperties())
            {
                property.SetColumnName(ToSnake(property.GetColumnName()));
            }

            foreach (var key in entity.GetKeys())
            {
                if (key.GetName() is { } name)
                {
                    key.SetName(ToSnake(name));
                }
            }

            foreach (var foreignKey in entity.GetForeignKeys())
            {
                if (foreignKey.GetConstraintName() is { } name)
                {
                    foreignKey.SetConstraintName(ToSnake(name));
                }
            }

            foreach (var index in entity.GetIndexes())
            {
                if (index.GetDatabaseName() is { } name)
                {
                    index.SetDatabaseName(ToSnake(name));
                }
            }
        }
    }

    private static string ToSnake(string name) => JsonNamingPolicy.SnakeCaseLower.ConvertName(name);
}
