using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FitIt.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class BodyProportions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "clothing_size",
                table: "users",
                type: "character varying(8)",
                maxLength: 8,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "leg_length",
                table: "users",
                type: "character varying(16)",
                maxLength: 16,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "clothing_size",
                table: "users");

            migrationBuilder.DropColumn(
                name: "leg_length",
                table: "users");
        }
    }
}
