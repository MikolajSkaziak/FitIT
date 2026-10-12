using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FitIt.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class OutfitCalendar : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "calendar_entries",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    outfit_id = table.Column<Guid>(type: "uuid", nullable: false),
                    day = table.Column<DateOnly>(type: "date", nullable: false),
                    worn = table.Column<bool>(type: "boolean", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_calendar_entries", x => x.id);
                    table.ForeignKey(
                        name: "fk_calendar_entries_outfits_outfit_id",
                        column: x => x.outfit_id,
                        principalTable: "outfits",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_calendar_entries_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_calendar_entries_outfit_id",
                table: "calendar_entries",
                column: "outfit_id");

            migrationBuilder.CreateIndex(
                name: "ix_calendar_entries_user_id_day_outfit_id",
                table: "calendar_entries",
                columns: new[] { "user_id", "day", "outfit_id" },
                unique: true);

            // History: until now an outfit only knew the last day it was worn on. That day becomes its first calendar entry.
            migrationBuilder.Sql("""
                INSERT INTO calendar_entries (id, user_id, outfit_id, day, worn, created_at)
                SELECT gen_random_uuid(), user_id, id, worn_on, TRUE, now()
                FROM outfits
                WHERE worn_on IS NOT NULL
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "calendar_entries");
        }
    }
}
