using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FitIt.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class Visualizations : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "visualizations",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    outfit_id = table.Column<Guid>(type: "uuid", nullable: false),
                    avatar_id = table.Column<Guid>(type: "uuid", nullable: false),
                    status = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    model = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: true),
                    prompt_version = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    provider_request_id = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    image_key = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    error_code = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: true),
                    idempotency_key = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    cost_usd = table.Column<decimal>(type: "numeric(12,6)", precision: 12, scale: 6, nullable: false),
                    usage_day = table.Column<DateOnly>(type: "date", nullable: false),
                    attempts = table.Column<int>(type: "integer", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    started_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    completed_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_visualizations", x => x.id);
                    table.ForeignKey(
                        name: "fk_visualizations_avatars_avatar_id",
                        column: x => x.avatar_id,
                        principalTable: "avatars",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_visualizations_outfits_outfit_id",
                        column: x => x.outfit_id,
                        principalTable: "outfits",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_visualizations_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_visualizations_avatar_id",
                table: "visualizations",
                column: "avatar_id");

            migrationBuilder.CreateIndex(
                name: "ix_visualizations_outfit_id_created_at",
                table: "visualizations",
                columns: new[] { "outfit_id", "created_at" });

            migrationBuilder.CreateIndex(
                name: "ix_visualizations_status_updated_at",
                table: "visualizations",
                columns: new[] { "status", "updated_at" });

            migrationBuilder.CreateIndex(
                name: "ix_visualizations_user_id_idempotency_key",
                table: "visualizations",
                columns: new[] { "user_id", "idempotency_key" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "visualizations");
        }
    }
}
