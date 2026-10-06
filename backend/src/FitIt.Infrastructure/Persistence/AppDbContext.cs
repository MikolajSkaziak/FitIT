using FitIt.Core.Accounts;
using FitIt.Core.Usage;
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

    public DbSet<ClothingItem> Clothes => Set<ClothingItem>();

    public DbSet<UsageCounter> UsageCounters => Set<UsageCounter>();

    public DbSet<AiUsageEntry> AiUsage => Set<AiUsageEntry>();

    protected override void ConfigureConventions(ModelConfigurationBuilder configurationBuilder)
    {
        configurationBuilder.Properties<Gender>().HaveConversion<EnumCodeConverter<Gender>>().HaveMaxLength(16);
        configurationBuilder.Properties<ThermalPreference>().HaveConversion<EnumCodeConverter<ThermalPreference>>().HaveMaxLength(16);
        configurationBuilder.Properties<LocationSource>().HaveConversion<EnumCodeConverter<LocationSource>>().HaveMaxLength(16);
        configurationBuilder.Properties<ClothingStatus>().HaveConversion<EnumCodeConverter<ClothingStatus>>().HaveMaxLength(16);
        configurationBuilder.Properties<Category>().HaveConversion<EnumCodeConverter<Category>>().HaveMaxLength(16);
        configurationBuilder.Properties<Subcategory>().HaveConversion<EnumCodeConverter<Subcategory>>().HaveMaxLength(32);
        configurationBuilder.Properties<Pattern>().HaveConversion<EnumCodeConverter<Pattern>>().HaveMaxLength(16);
        configurationBuilder.Properties<Material>().HaveConversion<EnumCodeConverter<Material>>().HaveMaxLength(16);
        configurationBuilder.Properties<RejectReason>().HaveConversion<EnumCodeConverter<RejectReason>>().HaveMaxLength(32);
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
            item.Property(i => i.Name).HasMaxLength(GarmentTags.NameMaxLength);
            item.Property(i => i.Description).HasMaxLength(ClothingItem.DescriptionMaxLength);
            item.Ignore(i => i.ImageKey);
            item.Ignore(i => i.Tags);
            item.HasIndex(i => i.OriginalKey).IsUnique();
            // The wardrobe list: one person's garments, newest first.
            item.HasIndex(i => new { i.UserId, i.CreatedAt });
            // The sweep that looks for garments stuck in processing.
            item.HasIndex(i => new { i.Status, i.UpdatedAt });
            item.HasOne<AppUser>().WithMany().HasForeignKey(i => i.UserId).OnDelete(DeleteBehavior.Cascade);
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
