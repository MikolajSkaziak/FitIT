using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FitIt.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AiUsageTokens : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "input_tokens",
                table: "ai_usage_log",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "output_tokens",
                table: "ai_usage_log",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "thought_tokens",
                table: "ai_usage_log",
                type: "integer",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "input_tokens",
                table: "ai_usage_log");

            migrationBuilder.DropColumn(
                name: "output_tokens",
                table: "ai_usage_log");

            migrationBuilder.DropColumn(
                name: "thought_tokens",
                table: "ai_usage_log");
        }
    }
}
