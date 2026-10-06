using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FitIt.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class Wardrobe : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ai_usage_log",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    operation = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    model = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    cost_usd = table.Column<decimal>(type: "numeric(12,6)", precision: 12, scale: 6, nullable: false),
                    duration_ms = table.Column<int>(type: "integer", nullable: false),
                    success = table.Column<bool>(type: "boolean", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_ai_usage_log", x => x.id);
                    table.ForeignKey(
                        name: "fk_ai_usage_log_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "clothing_items",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    status = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    original_key = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    cutout_key = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    category = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: true),
                    subcategory = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: true),
                    name = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: true),
                    description = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    colors = table.Column<string[]>(type: "text[]", nullable: false),
                    pattern = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: true),
                    material = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: true),
                    formality = table.Column<int>(type: "integer", nullable: true),
                    warmth = table.Column<int>(type: "integer", nullable: true),
                    rain_ok = table.Column<bool>(type: "boolean", nullable: true),
                    styles = table.Column<string[]>(type: "text[]", nullable: false),
                    in_laundry = table.Column<bool>(type: "boolean", nullable: false),
                    rarely_worn = table.Column<bool>(type: "boolean", nullable: false),
                    wear_count = table.Column<int>(type: "integer", nullable: false),
                    last_worn_on = table.Column<DateOnly>(type: "date", nullable: true),
                    reject_reason = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: true),
                    attempts = table.Column<int>(type: "integer", nullable: false),
                    deferred_until = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_clothing_items", x => x.id);
                    table.CheckConstraint("ck_clothing_items_formality", "formality BETWEEN 1 AND 5");
                    table.CheckConstraint("ck_clothing_items_warmth", "warmth BETWEEN 1 AND 5");
                    table.ForeignKey(
                        name: "fk_clothing_items_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "usage_counters",
                columns: table => new
                {
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    day = table.Column<DateOnly>(type: "date", nullable: false),
                    kind = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    count = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_usage_counters", x => new { x.user_id, x.day, x.kind });
                    table.ForeignKey(
                        name: "fk_usage_counters_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_ai_usage_log_created_at",
                table: "ai_usage_log",
                column: "created_at");

            migrationBuilder.CreateIndex(
                name: "ix_ai_usage_log_user_id",
                table: "ai_usage_log",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "ix_clothing_items_original_key",
                table: "clothing_items",
                column: "original_key",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_clothing_items_status_updated_at",
                table: "clothing_items",
                columns: new[] { "status", "updated_at" });

            migrationBuilder.CreateIndex(
                name: "ix_clothing_items_user_id_created_at",
                table: "clothing_items",
                columns: new[] { "user_id", "created_at" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ai_usage_log");

            migrationBuilder.DropTable(
                name: "clothing_items");

            migrationBuilder.DropTable(
                name: "usage_counters");
        }
    }
}
