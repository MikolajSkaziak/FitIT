using FitIt.Core.Accounts;
using FitIt.Core.Wardrobe;
using Microsoft.AspNetCore.Hosting;

namespace FitIt.Infrastructure.Visualizations;

/// <summary>
/// Makes a silhouette reachable the way every other picture is: a copy in the person's own storage prefix, read through a
/// signed address. The silhouettes are public static files, but the image model must not depend on where the API is
/// published, and a copy under the person's prefix goes away with the account.
/// </summary>
public sealed class SilhouetteStore(IImageStorage storage, IWebHostEnvironment environment)
{
    public async Task<ImageSource> EnsureAsync(Guid userId, Avatar avatar, TimeSpan lifetime, CancellationToken cancellationToken)
    {
        var key = ObjectKeys.Silhouette(userId, avatar.Id);
        if (await storage.FindAsync(key, cancellationToken) is null)
        {
            var file = environment.WebRootFileProvider.GetFileInfo(avatar.ImagePath);
            if (!file.Exists)
            {
                throw new InvalidOperationException($"The silhouette picture {avatar.ImagePath} is missing from the static files.");
            }

            await using var stream = file.CreateReadStream();
            using var memory = new MemoryStream();
            await stream.CopyToAsync(memory, cancellationToken);
            await storage.WriteAsync(key, memory.ToArray(), "image/jpeg", cancellationToken);
        }

        return new ImageSource(key, storage.SignRead(key, lifetime));
    }
}
