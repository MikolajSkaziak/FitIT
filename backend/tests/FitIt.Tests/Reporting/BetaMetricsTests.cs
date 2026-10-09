using System.Globalization;
using System.Text.RegularExpressions;
using FitIt.Api.Contracts;
using FitIt.Infrastructure.Persistence;
using FitIt.Tests.Support;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;
using static FitIt.Tests.Styling.Dressing;

namespace FitIt.Tests.Reporting;

/// <summary>
/// The queries of <c>backend/sql/beta-metrics.sql</c> (plan 5.10), run against the schema the migrations make. Not to check
/// PostgreSQL, but to make a renamed column or table fail here instead of on the dashboard on the day it is needed.
/// </summary>
[Collection(ApiTests.Name)]
public sealed partial class BetaMetricsTests(ApiFactory factory)
{
    private static readonly string[] Expected =
    [
        "active_people_per_day", "active_people_per_week", "garments_added_per_person", "garments_added_summary",
        "suggestions_requested_per_day", "suggestions_requested_per_person", "proposals_saved_liked_worn", "proposals_by_kind",
        "worn_outfits_with_forgotten_garment", "wardrobe_usage_per_person", "wardrobe_usage_summary", "ai_cost_per_person",
        "ai_cost_per_person_per_operation", "ai_cost_per_operation", "ai_cost_per_day", "ai_cost_per_active_person_per_week",
        "fallback_share", "visualizations_by_outcome",
    ];

    [GeneratedRegex(@"\b(insert|update|delete|drop|truncate|alter|create|grant|revoke)\b", RegexOptions.IgnoreCase)]
    private static partial Regex Writes();

    [Fact]
    public void The_file_holds_every_metric_the_plan_asks_for_each_with_a_comment_and_none_changes_data()
    {
        var queries = Queries();

        Assert.Equal(Expected, queries.Select(query => query.Name));
        Assert.All(queries, query =>
        {
            Assert.True(query.Comment.Length > 20, $"{query.Name} has no comment saying what it measures.");
            Assert.EndsWith(";", query.Sql, StringComparison.Ordinal);
            Assert.DoesNotMatch(Writes(), query.Sql);
        });
        Assert.DoesNotMatch(Writes(), string.Join('\n', File.ReadAllLines(PathOfFile()).Where(line => !line.TrimStart().StartsWith("--", StringComparison.Ordinal))));
    }

    [Fact]
    public async Task Every_query_runs_against_the_schema_of_the_migrations_with_data_in_it()
    {
        await PersonWithABetaAsync();

        foreach (var query in Queries())
        {
            Assert.NotEmpty((await RunAsync(query)).Columns);
        }
    }

    [Fact]
    public async Task Every_query_also_runs_on_a_database_with_nothing_in_it_without_dividing_by_zero()
    {
        var shared = factory.Services.GetRequiredService<IConfiguration>().GetConnectionString("Database")!;
        var name = $"beta_empty_{Guid.NewGuid():N}";
        await using (var admin = new NpgsqlConnection(shared))
        {
            await admin.OpenAsync();
            await using var create = new NpgsqlCommand($"CREATE DATABASE {name}", admin);
            await create.ExecuteNonQueryAsync();
        }

        var emptied = new NpgsqlConnectionStringBuilder(shared) { Database = name, Pooling = false }.ConnectionString;
        try
        {
            // The schema exactly as the migrations make it, and not a row in it.
            await using (var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseNpgsql(emptied).Options))
            {
                await db.Database.MigrateAsync();
            }

            await using var connection = new NpgsqlConnection(emptied);
            await connection.OpenAsync();
            foreach (var query in Queries())
            {
                Assert.NotEmpty((await RunOnAsync(connection, query, pinned: false)).Columns);
            }

            // A query over nothing is one row of zeros or no row, never an error.
            Assert.Equal(0L, (await RunOnAsync(connection, Queries().Single(query => query.Name == "garments_added_summary"), pinned: false)).Rows[0]["people"]);
        }
        finally
        {
            await using var admin = new NpgsqlConnection(shared);
            await admin.OpenAsync();
            await using var drop = new NpgsqlCommand($"DROP DATABASE IF EXISTS {name} WITH (FORCE)", admin);
            await drop.ExecuteNonQueryAsync();
        }
    }

    [Fact]
    public async Task The_columns_of_every_query_are_the_ones_a_dashboard_would_read()
    {
        var expected = new Dictionary<string, string[]>
        {
            ["active_people_per_day"] = ["day", "active_people"],
            ["active_people_per_week"] = ["week", "active_people"],
            ["garments_added_per_person"] = ["user_id", "registered_on", "added", "ready", "waiting_for_tags", "processing", "refused"],
            ["garments_added_summary"] = ["people", "people_with_garments", "average_added", "median_added", "most_added"],
            ["suggestions_requested_per_day"] = ["day", "requests", "answered_requests"],
            ["suggestions_requested_per_person"] = ["user_id", "requests", "proposals", "first_request_at", "last_request_at"],
            ["proposals_saved_liked_worn"] = ["week", "proposals", "saved_percent", "liked_percent", "disliked_percent", "worn_percent"],
            ["proposals_by_kind"] = ["kind", "proposals", "saved_percent", "liked_percent", "worn_percent"],
            ["worn_outfits_with_forgotten_garment"] = ["worn_outfits", "worn_discoveries", "discovery_percent"],
            ["wardrobe_usage_per_person"] = ["user_id", "ready_garments", "worn_last_30_days", "usage_percent"],
            ["wardrobe_usage_summary"] = ["people_with_ready_garments", "average_usage_percent", "median_usage_percent", "people_wearing_something_percent"],
            ["ai_cost_per_person"] = ["user_id", "calls", "failed_calls", "cost_usd", "first_call_at", "last_call_at"],
            ["ai_cost_per_person_per_operation"] = ["user_id", "operation", "calls", "cost_usd"],
            ["ai_cost_per_operation"] = ["operation", "model", "calls", "success_percent", "cost_usd", "average_cost_usd", "average_ms", "p95_ms"],
            ["ai_cost_per_day"] = ["day", "calls", "cost_usd"],
            ["ai_cost_per_active_person_per_week"] = ["week", "active_people", "cost_usd", "cost_usd_per_active_person"],
            ["fallback_share"] = ["week", "requests", "by_rules", "fallback_percent"],
            ["visualizations_by_outcome"] = ["status", "error_code", "visualizations", "cost_usd", "average_seconds"],
        };

        foreach (var query in Queries())
        {
            Assert.Equal(expected[query.Name], (await RunAsync(query)).Columns);
        }

        Assert.Equal(expected.Keys.Order(), Queries().Select(query => query.Name).Order());
    }

    [Fact]
    public async Task The_numbers_for_a_person_are_what_the_person_did()
    {
        var beta = await PersonWithABetaAsync();
        var id = beta.UserId;

        // Garments: nine ready ones, none refused.
        var added = Single(await RunAsync("garments_added_per_person"), id);
        Assert.Equal((9L, 9L, 0L, 0L, 0L), (added["added"], added["ready"], added["waiting_for_tags"], added["processing"], added["refused"]));

        // Wardrobe usage: the outfit that was worn has between three and six garments; the rest were not worn.
        var usage = Single(await RunAsync("wardrobe_usage_per_person"), id);
        Assert.Equal(9L, usage["ready_garments"]);
        Assert.Equal((long)beta.WornGarments, usage["worn_last_30_days"]);

        // Proposals: three of one request, one saved, one liked, one worn.
        var requests = Single(await RunAsync("suggestions_requested_per_person"), id);
        Assert.Equal((1L, 3L), (requests["requests"], requests["proposals"]));

        // Cost: tagging cost nothing, styling 0.02 and one picture 0.08, in four calls with none failed.
        var cost = Single(await RunAsync("ai_cost_per_person"), id);
        Assert.Equal(0.10m, cost["cost_usd"]);
        Assert.Equal(0L, cost["failed_calls"]);
        var byOperation = (await RunAsync("ai_cost_per_person_per_operation")).Rows.Where(row => Equals(row["user_id"], id)).ToDictionary(row => (string)row["operation"]!, row => (decimal)row["cost_usd"]!);
        Assert.Equal((0.02m, 0.08m, 0m), (byOperation["styling"], byOperation["visualization"], byOperation["tagging"]));
    }

    [Fact]
    public async Task The_shares_count_proposals_saved_liked_worn_and_the_fallback_over_everything_there_is()
    {
        await PersonWithABetaAsync();

        var shares = (await RunAsync("proposals_saved_liked_worn")).Rows;
        var total = Assert.Single(shares, row => row["week"] is null);
        var proposals = (long)total["proposals"]!;
        Assert.True(proposals >= 3);
        foreach (var column in new[] { "saved_percent", "liked_percent", "disliked_percent", "worn_percent" })
        {
            Assert.InRange((decimal)total[column]!, 0m, 100m);
        }

        Assert.Equal(proposals, shares.Where(row => row["week"] is not null).Sum(row => (long)row["proposals"]!));
        Assert.Equal(proposals, (await RunAsync("proposals_by_kind")).Rows.Sum(row => (long)row["proposals"]!));
        var worn = Assert.Single((await RunAsync("worn_outfits_with_forgotten_garment")).Rows);
        Assert.True((long)worn["worn_outfits"]! >= 1);
        var fallback = Assert.Single((await RunAsync("fallback_share")).Rows, row => row["week"] is null);
        Assert.True((long)fallback["requests"]! >= 1);
    }

    [Fact]
    public async Task Activity_is_counted_per_day_and_week_and_the_cost_per_operation_includes_the_pictures()
    {
        await PersonWithABetaAsync();

        // The windows are "the last 30 days" of the database's clock, and the tests' clock is another one: pin both to the same moment.
        var perDay = await RunAsync("active_people_per_day", pinned: true);
        var today = DateOnly.FromDateTime(factory.Clock.GetUtcNow().UtcDateTime);
        Assert.True((long)Assert.Single(perDay.Rows, row => Equals(row["day"], today))["active_people"]! >= 1);
        Assert.True((long)Assert.Single((await RunAsync("active_people_per_week", pinned: true)).Rows, row => ((DateOnly)row["week"]!) <= today && ((DateOnly)row["week"]!) > today.AddDays(-7))["active_people"]! >= 1);

        var operations = (await RunAsync("ai_cost_per_operation")).Rows.Select(row => (string)row["operation"]!).Distinct().ToList();
        Assert.Contains("visualization", operations);
        Assert.Contains("styling", operations);
        Assert.Contains("tagging", operations);

        var perWeek = (await RunAsync("ai_cost_per_active_person_per_week", pinned: true)).Rows;
        Assert.NotEmpty(perWeek);
        Assert.All(perWeek, row => Assert.True((long)row["active_people"]! >= 1));
        Assert.NotEmpty((await RunAsync("ai_cost_per_day", pinned: true)).Rows);
        Assert.NotEmpty((await RunAsync("suggestions_requested_per_day", pinned: true)).Rows);
        Assert.NotEmpty((await RunAsync("visualizations_by_outcome")).Rows);
    }

    [Fact]
    public async Task A_deleted_account_leaves_its_cost_under_no_name()
    {
        var beta = await PersonWithABetaAsync();
        await beta.Client.SendAsync(new HttpRequestMessage(HttpMethod.Delete, "/api/me") { Content = System.Net.Http.Json.JsonContent.Create(new { password = TestApi.Password }) });

        var perPerson = (await RunAsync("ai_cost_per_person")).Rows;

        Assert.DoesNotContain(perPerson, row => Equals(row["user_id"], beta.UserId));
        Assert.True((decimal)Assert.Single(perPerson, row => row["user_id"] is null)["cost_usd"]! >= 0.10m);
    }

    // ---- helpers ---------------------------------------------------------------------------------------------------

    private sealed record Query(string Name, string Comment, string Sql);

    private sealed record Result(IReadOnlyList<string> Columns, IReadOnlyList<Dictionary<string, object?>> Rows);

    private sealed record Beta(HttpClient Client, Guid UserId, int WornGarments);

    private static string PathOfFile() => Path.Combine(AppContext.BaseDirectory, "sql", "beta-metrics.sql");

    /// <summary>The blocks of the file: a "-- name:" line, the comment lines after it, and the statement.</summary>
    private static List<Query> Queries()
    {
        var queries = new List<Query>();
        string? name = null;
        List<string> comment = [], sql = [];
        void Close()
        {
            if (name is not null)
            {
                queries.Add(new Query(name, string.Join(' ', comment), string.Join('\n', sql).Trim()));
            }
        }

        foreach (var line in File.ReadAllLines(PathOfFile()))
        {
            if (line.StartsWith("-- name:", StringComparison.Ordinal))
            {
                Close();
                (name, comment, sql) = (line["-- name:".Length..].Trim(), [], []);
            }
            else if (name is not null && line.StartsWith("--", StringComparison.Ordinal))
            {
                comment.Add(line.TrimStart('-').Trim());
            }
            else if (name is not null)
            {
                sql.Add(line);
            }
        }

        Close();
        return queries;
    }

    private Task<Result> RunAsync(string name, bool pinned = false) => RunAsync(Queries().Single(query => query.Name == name), pinned);

    /// <summary>
    /// Runs one query. With <paramref name="pinned"/> the database's own clock in the query is replaced by the tests' clock,
    /// so that "the last 30 days" are the days the test data was made in.
    /// </summary>
    private async Task<Result> RunAsync(Query query, bool pinned = false) =>
        await factory.WithDatabaseAsync(async db =>
        {
            await db.Database.OpenConnectionAsync();
            try
            {
                return await RunOnAsync((NpgsqlConnection)db.Database.GetDbConnection(), query, pinned);
            }
            finally
            {
                await db.Database.CloseConnectionAsync();
            }
        });

    private async Task<Result> RunOnAsync(NpgsqlConnection connection, Query query, bool pinned)
    {
        var sql = query.Sql;
        if (pinned)
        {
            var now = factory.Clock.GetUtcNow();
            sql = sql.Replace("now()", $"'{now.UtcDateTime.ToString("O", CultureInfo.InvariantCulture)}'::timestamptz", StringComparison.Ordinal)
                .Replace("current_date", $"'{now.UtcDateTime.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture)}'::date", StringComparison.Ordinal);
        }

        try
        {
            await using var command = new NpgsqlCommand(sql, connection);
            await using var reader = await command.ExecuteReaderAsync();
            var columns = Enumerable.Range(0, reader.FieldCount).Select(reader.GetName).ToList();
            var rows = new List<Dictionary<string, object?>>();
            while (await reader.ReadAsync())
            {
                rows.Add(columns.Select((column, index) => (column, value: reader.IsDBNull(index) ? null : reader.GetValue(index))).ToDictionary(pair => pair.column, pair => pair.value));
            }

            return new Result(columns, rows);
        }
        catch (PostgresException exception)
        {
            throw new InvalidOperationException($"The query '{query.Name}' fails against the schema: {exception.MessageText}", exception);
        }
    }

    private static Dictionary<string, object?> Single(Result result, Guid userId) =>
        Assert.Single(result.Rows, row => Equals(row["user_id"], userId));

    /// <summary>A person who did what a beta tester does: added garments, asked for proposals, saved, liked and wore one, ordered a picture.</summary>
    private async Task<Beta> PersonWithABetaAsync()
    {
        var (client, auth, _) = await factory.DressedAsync(Warm, Basics);
        factory.Visualizer.Reset();
        factory.Stylist.AnswersWell(cost: 0.02m);
        factory.Jobs.Clear();
        var outfits = (await client.SuggestedAsync()).Outfits;
        var outfit = outfits[0];
        await client.PatchJsonAsync($"/api/outfits/{outfit.Id}", new System.Text.Json.Nodes.JsonObject { ["saved"] = true, ["rating"] = "like", ["worn"] = true });
        var order = await (await Order(client, outfit.Id)).ReadAsync<VisualizationResponse>();
        await factory.RunVisualizationAsync(order.Id);
        return new Beta(client, auth.User.Id, outfit.Items.Count);
    }

    private static Task<HttpResponseMessage> Order(HttpClient client, Guid outfit)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, $"/api/outfits/{outfit}/visualizations");
        request.Headers.Add("Idempotency-Key", Guid.NewGuid().ToString("N"));
        return client.SendAsync(request);
    }
}
