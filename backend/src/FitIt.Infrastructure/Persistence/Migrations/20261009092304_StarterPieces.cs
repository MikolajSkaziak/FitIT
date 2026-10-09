using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FitIt.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class StarterPieces : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "starter_code",
                table: "clothing_items",
                type: "character varying(40)",
                maxLength: 40,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "ix_clothing_items_user_id_starter_code",
                table: "clothing_items",
                columns: new[] { "user_id", "starter_code" },
                unique: true,
                filter: "starter_code IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_clothing_items_user_id_starter_code",
                table: "clothing_items");

            migrationBuilder.DropColumn(
                name: "starter_code",
                table: "clothing_items");
        }
    }
}
