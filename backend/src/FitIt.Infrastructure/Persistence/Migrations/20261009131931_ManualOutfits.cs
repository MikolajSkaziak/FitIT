using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FitIt.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ManualOutfits : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<string>(
                name: "weather_snapshot",
                table: "outfits",
                type: "jsonb",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "jsonb");

            migrationBuilder.AddColumn<string>(
                name: "name",
                table: "outfits",
                type: "character varying(60)",
                maxLength: 60,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "name",
                table: "outfits");

            migrationBuilder.AlterColumn<string>(
                name: "weather_snapshot",
                table: "outfits",
                type: "jsonb",
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "jsonb",
                oldNullable: true);
        }
    }
}
