using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FitIt.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ColorsAndOnboarding : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "color_analysis",
                table: "users",
                type: "jsonb",
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "onboarding_done_at",
                table: "users",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "onboarding_step",
                table: "users",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            // People who already have an account have been through sign-up: they never see the post-registration flow.
            migrationBuilder.Sql("UPDATE users SET onboarding_done_at = created_at;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "color_analysis",
                table: "users");

            migrationBuilder.DropColumn(
                name: "onboarding_done_at",
                table: "users");

            migrationBuilder.DropColumn(
                name: "onboarding_step",
                table: "users");
        }
    }
}
