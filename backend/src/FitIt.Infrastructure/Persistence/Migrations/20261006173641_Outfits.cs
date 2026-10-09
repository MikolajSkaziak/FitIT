using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FitIt.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class Outfits : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "outfits",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    request_id = table.Column<Guid>(type: "uuid", nullable: false),
                    occasion = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    occasion_note = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    weather_snapshot = table.Column<string>(type: "jsonb", nullable: false),
                    relaxations = table.Column<string[]>(type: "text[]", nullable: false),
                    umbrella = table.Column<bool>(type: "boolean", nullable: false),
                    source = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    kind = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: true),
                    score = table.Column<int>(type: "integer", nullable: false),
                    reasoning = table.Column<string>(type: "character varying(600)", maxLength: 600, nullable: false),
                    weather_note = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    prompt_version = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    model = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: true),
                    rating = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    rated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    is_saved = table.Column<bool>(type: "boolean", nullable: false),
                    worn_on = table.Column<DateOnly>(type: "date", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_outfits", x => x.id);
                    table.CheckConstraint("ck_outfits_score", "score BETWEEN 0 AND 100");
                    table.ForeignKey(
                        name: "fk_outfits_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "outfit_items",
                columns: table => new
                {
                    outfit_id = table.Column<Guid>(type: "uuid", nullable: false),
                    clothing_item_id = table.Column<Guid>(type: "uuid", nullable: false),
                    slot = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_outfit_items", x => new { x.outfit_id, x.clothing_item_id });
                    table.ForeignKey(
                        name: "fk_outfit_items_clothing_items_clothing_item_id",
                        column: x => x.clothing_item_id,
                        principalTable: "clothing_items",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_outfit_items_outfits_outfit_id",
                        column: x => x.outfit_id,
                        principalTable: "outfits",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_outfit_items_clothing_item_id",
                table: "outfit_items",
                column: "clothing_item_id");

            migrationBuilder.CreateIndex(
                name: "ix_outfits_request_id",
                table: "outfits",
                column: "request_id");

            migrationBuilder.CreateIndex(
                name: "ix_outfits_user_id_created_at",
                table: "outfits",
                columns: new[] { "user_id", "created_at" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "outfit_items");

            migrationBuilder.DropTable(
                name: "outfits");
        }
    }
}
