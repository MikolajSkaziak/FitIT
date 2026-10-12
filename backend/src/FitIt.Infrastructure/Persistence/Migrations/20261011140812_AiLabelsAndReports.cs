using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FitIt.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AiLabelsAndReports : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "described_by_ai",
                table: "clothing_items",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateTable(
                name: "visualization_reports",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    visualization_id = table.Column<Guid>(type: "uuid", nullable: false),
                    outfit_id = table.Column<Guid>(type: "uuid", nullable: false),
                    reason = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_visualization_reports", x => x.id);
                    table.ForeignKey(
                        name: "fk_visualization_reports_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_visualization_reports_created_at",
                table: "visualization_reports",
                column: "created_at");

            migrationBuilder.CreateIndex(
                name: "ix_visualization_reports_user_id",
                table: "visualization_reports",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "ix_visualization_reports_visualization_id",
                table: "visualization_reports",
                column: "visualization_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "visualization_reports");

            migrationBuilder.DropColumn(
                name: "described_by_ai",
                table: "clothing_items");
        }
    }
}
