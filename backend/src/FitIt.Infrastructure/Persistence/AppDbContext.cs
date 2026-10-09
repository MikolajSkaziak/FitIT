using FitIt.Core.Accounts;
using FitIt.Core.Styling;
using FitIt.Core.Usage;
using FitIt.Core.Visualizations;
using FitIt.Core.Wardrobe;
using FitIt.Infrastructure.Identity;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace FitIt.Infrastructure.Persistence;

public sealed class AppDbContext(DbContextOptions<AppDbContext> options) : IdentityUserContext<AppUser, Guid>(options)
{
    public DbSet<Avatar> Avatars => Set<Avatar>();

    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();

    public DbSet<PasswordResetCode> PasswordResetCodes => Set<PasswordResetCode>();

    public DbSet<Visualization> Visualizations => Set<Visualization>();

    public DbSet<ClothingItem> Clothes => Set<ClothingItem>();

    public DbSet<Outfit> Outfits => Set<Outfit>();

    public DbSet<OutfitItem> OutfitItems => Set<OutfitItem>();

    public DbSet<UsageCounter> UsageCounters => Set<UsageCounter>();

    public DbSet<AiUsageEntry> AiUsage => Set<AiUsageEntry>();

    protected override void ConfigureConventions(ModelConfigurationBuilder configurationBuilder)
    {
        configurationBuilder.Properties<Gender>().HaveConversion<EnumCodeConverter<Gender>>().HaveMaxLength(16);
        configurationBuilder.Properties<ThermalPreference>().HaveConversion<EnumCodeConverter<ThermalPreference>>().HaveMaxLength(16);
        configurationBuilder.Properties<ClothingSize>().HaveConversion<EnumCodeConverter<ClothingSize>>().HaveMaxLength(8);
        configurationBuilder.Properties<LegLength>().HaveConversion<EnumCodeConverter<LegLength>>().HaveMaxLength(16);
        configurationBuilder.Properties<LocationSource>().HaveConversion<EnumCodeConverter<LocationSource>>().HaveMaxLength(16);
        configurationBuilder.Properties<ClothingStatus>().HaveConversion<EnumCodeConverter<ClothingStatus>>().HaveMaxLength(16);
        configurationBuilder.Properties<Category>().HaveConversion<EnumCodeConverter<Category>>().HaveMaxLength(16);
        configurationBuilder.Properties<Subcategory>().HaveConversion<EnumCodeConverter<Subcategory>>().HaveMaxLength(32);
        configurationBuilder.Properties<Pattern>().HaveConversion<EnumCodeConverter<Pattern>>().HaveMaxLength(16);
        configurationBuilder.Properties<Material>().HaveConversion<EnumCodeConverter<Material>>().HaveMaxLength(16);
        configurationBuilder.Properties<RejectReason>().HaveConversion<EnumCodeConverter<RejectReason>>().HaveMaxLength(32);
        configurationBuilder.Properties<Occasion>().HaveConversion<EnumCodeConverter<Occasion>>().HaveMaxLength(16);
        configurationBuilder.Properties<OutfitKind>().HaveConversion<EnumCodeConverter<OutfitKind>>().HaveMaxLength(16);
        configurationBuilder.Properties<OutfitSource>().HaveConversion<EnumCodeConverter<OutfitSource>>().HaveMaxLength(16);
        configurationBuilder.Properties<OutfitRating>().HaveConversion<EnumCodeConverter<OutfitRating>>().HaveMaxLength(16);
        configurationBuilder.Properties<VisualizationStatus>().HaveConversion<EnumCodeConverter<VisualizationStatus>>().HaveMaxLength(16);
        configurationBuilder.Properties<UsageKind>().HaveConversion<EnumCodeConverter<UsageKind>>().HaveMaxLength(16);
        configurationBuilder.Properties<AiOperation>().HaveConversion<EnumCodeConverter<AiOperation>>().HaveMaxLength(32);
    }

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        builder.Entity<AppUser>(user =>
        {
            user.ToTable("users");
            user.Property(u => u.DisplayName).HasMaxLength(40);
            user.Property(u => u.LocationName).HasMaxLength(WeatherPlace.NameMaxLength);
            user.HasOne(u => u.Avatar).WithMany().HasForeignKey(u => u.AvatarId).OnDelete(DeleteBehavior.Restrict);
            user.Ignore(u => u.Place);
            user.Property(u => u.ColorAnalysis).HasColumnType("jsonb").HasConversion<JsonDocumentConverter<ColorProfile>>();
        });
        builder.Entity<IdentityUserClaim<Guid>>().ToTable("user_claims");
        builder.Entity<IdentityUserLogin<Guid>>().ToTable("user_logins");
        builder.Entity<IdentityUserToken<Guid>>().ToTable("user_tokens");

        builder.Entity<Avatar>(avatar =>
        {
            avatar.ToTable("avatars");
            avatar.Property(a => a.Id).ValueGeneratedNever();
            avatar.Property(a => a.BodyType).HasMaxLength(32);
            avatar.Property(a => a.Label).HasMaxLength(64);
            avatar.Property(a => a.ImagePath).HasMaxLength(200);
            avatar.Property(a => a.ThumbPath).HasMaxLength(200);
            avatar.HasIndex(a => new { a.Gender, a.BodyType }).IsUnique();
        });

        builder.Entity<RefreshToken>(token =>
        {
            token.ToTable("refresh_tokens");
            token.Property(t => t.Id).ValueGeneratedNever();
            token.Property(t => t.TokenHash).HasMaxLength(64);
            token.HasIndex(t => t.TokenHash).IsUnique();
            token.HasIndex(t => t.UserId);
            token.HasOne<AppUser>().WithMany().HasForeignKey(t => t.UserId).OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<PasswordResetCode>(code =>
        {
            code.ToTable("password_reset_codes");
            code.Property(c => c.Id).ValueGeneratedNever();
            code.Property(c => c.CodeHash).HasMaxLength(64);
            // The newest code of one person, and how many were sent to them lately.
            code.HasIndex(c => new { c.UserId, c.CreatedAt });
            code.HasOne<AppUser>().WithMany().HasForeignKey(c => c.UserId).OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<ClothingItem>(item =>
        {
            item.ToTable("clothing_items", table =>
            {
                table.HasCheckConstraint("ck_clothing_items_formality", "formality BETWEEN 1 AND 5");
                table.HasCheckConstraint("ck_clothing_items_warmth", "warmth BETWEEN 1 AND 5");
            });
            item.Property(i => i.Id).ValueGeneratedNever();
            item.Property(i => i.OriginalKey).HasMaxLength(120);
            item.Property(i => i.CutoutKey).HasMaxLength(120);
            item.Property(i => i.StarterCode).HasMaxLength(40);
            item.Property(i => i.Name).HasMaxLength(GarmentTags.NameMaxLength);
            item.Property(i => i.Description).HasMaxLength(ClothingItem.DescriptionMaxLength);
            item.Ignore(i => i.ImageKey);
            item.Ignore(i => i.Tags);
            item.HasIndex(i => i.OriginalKey).IsUnique();
            // A starter piece is added to a wardrobe once, also when two requests arrive at the same time.
            item.HasIndex(i => new { i.UserId, i.StarterCode }).IsUnique().HasFilter("starter_code IS NOT NULL");
            // The wardrobe list: one person's garments, newest first.
            item.HasIndex(i => new { i.UserId, i.CreatedAt });
            // The sweep that looks for garments stuck in processing.
            item.HasIndex(i => new { i.Status, i.UpdatedAt });
            item.HasOne<AppUser>().WithMany().HasForeignKey(i => i.UserId).OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<Outfit>(outfit =>
        {
            outfit.ToTable("outfits", table => table.HasCheckConstraint("ck_outfits_score", "score BETWEEN 0 AND 100"));
            outfit.Property(o => o.Id).ValueGeneratedNever();
            outfit.Property(o => o.OccasionNote).HasMaxLength(Outfit.NoteMaxLength);
            outfit.Property(o => o.Name).HasMaxLength(Outfit.NameMaxLength);
            outfit.Property(o => o.Weather).HasColumnName("weather_snapshot").HasColumnType("jsonb").HasConversion<JsonDocumentConverter<WeatherSnapshot>>();
            outfit.Property(o => o.Reasoning).HasMaxLength(Outfit.ReasoningMaxLength);
            outfit.Property(o => o.WeatherNote).HasMaxLength(Outfit.WeatherNoteMaxLength);
            outfit.Property(o => o.PromptVersion).HasMaxLength(40);
            outfit.Property(o => o.Model).HasMaxLength(80);
            // One person's outfits, newest first; the three proposals of one request are found by the request.
            outfit.HasIndex(o => new { o.UserId, o.CreatedAt });
            outfit.HasIndex(o => o.RequestId);
            outfit.HasOne<AppUser>().WithMany().HasForeignKey(o => o.UserId).OnDelete(DeleteBehavior.Cascade);
            outfit.HasMany(o => o.Items).WithOne().HasForeignKey(i => i.OutfitId).OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<OutfitItem>(item =>
        {
            item.ToTable("outfit_items");
            item.HasKey(i => new { i.OutfitId, i.ClothingItemId });
            // "Which outfits contain this garment": asked when a garment is deleted and when likes are counted.
            item.HasIndex(i => i.ClothingItemId);
            // The row goes with the garment; the outfit it belonged to is deleted by the wardrobe service, which knows an outfit with a hole is no outfit.
            item.HasOne<ClothingItem>().WithMany().HasForeignKey(i => i.ClothingItemId).OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<Visualization>(visualization =>
        {
            visualization.ToTable("visualizations");
            visualization.Property(v => v.Id).ValueGeneratedNever();
            visualization.Property(v => v.Model).HasMaxLength(80);
            visualization.Property(v => v.PromptVersion).HasMaxLength(40);
            visualization.Property(v => v.ProviderRequestId).HasMaxLength(200);
            visualization.Property(v => v.ImageKey).HasMaxLength(120);
            visualization.Property(v => v.ErrorCode).HasMaxLength(32);
            visualization.Property(v => v.IdempotencyKey).HasMaxLength(Visualization.IdempotencyKeyMaxLength);
            visualization.Property(v => v.CostUsd).HasPrecision(12, 6);
            // The same key from the same person is the same order, also when two requests arrive at once.
            visualization.HasIndex(v => new { v.UserId, v.IdempotencyKey }).IsUnique();
            // The latest visualization of an outfit.
            visualization.HasIndex(v => new { v.OutfitId, v.CreatedAt });
            // The sweep that looks for orders that stopped moving.
            visualization.HasIndex(v => new { v.Status, v.UpdatedAt });
            visualization.HasOne<AppUser>().WithMany().HasForeignKey(v => v.UserId).OnDelete(DeleteBehavior.Cascade);
            // The files go first, in code: the row only follows its outfit.
            visualization.HasOne<Outfit>().WithMany().HasForeignKey(v => v.OutfitId).OnDelete(DeleteBehavior.Cascade);
            visualization.HasOne<Avatar>().WithMany().HasForeignKey(v => v.AvatarId).OnDelete(DeleteBehavior.Restrict);
        });

        builder.Entity<UsageCounter>(counter =>
        {
            counter.ToTable("usage_counters");
            counter.HasKey(c => new { c.UserId, c.Day, c.Kind });
            counter.HasOne<AppUser>().WithMany().HasForeignKey(c => c.UserId).OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<AiUsageEntry>(entry =>
        {
            entry.ToTable("ai_usage_log");
            entry.Property(e => e.Id).ValueGeneratedNever();
            entry.Property(e => e.Model).HasMaxLength(80);
            entry.Property(e => e.CostUsd).HasPrecision(12, 6);
            // The day's total for the budget check.
            entry.HasIndex(e => e.CreatedAt);
            // What was spent stays known after an account is deleted; who spent it does not.
            entry.HasOne<AppUser>().WithMany().HasForeignKey(e => e.UserId).OnDelete(DeleteBehavior.SetNull);
        });

        builder.UseSnakeCaseNames();
    }
}
