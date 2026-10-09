using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FitIt.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class Seasons : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string[]>(
                name: "seasons",
                table: "clothing_items",
                type: "text[]",
                nullable: false,
                defaultValue: new string[0]);

            // The same rule as GarmentCatalog.SeasonsFor: light is spring and summer, mid-weight spring and fall, warm fall and winter.
            migrationBuilder.Sql(
                """
                UPDATE clothing_items
                SET seasons = CASE
                    WHEN warmth <= 2 THEN ARRAY['spring', 'summer']
                    WHEN warmth = 3 THEN ARRAY['spring', 'fall']
                    ELSE ARRAY['fall', 'winter']
                END
                WHERE warmth IS NOT NULL;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "seasons",
                table: "clothing_items");
        }
    }
}
