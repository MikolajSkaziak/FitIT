using System.Collections.Frozen;
using System.Text;
using FitIt.Core.Common;

namespace FitIt.Core.Wardrobe;

/// <summary>
/// What each style means, in words a model can work from: the shapes, the fabrics, the colours, the pieces that carry it
/// and what it keeps away from. The tagger reads all of them to decide which styles a garment suits; the stylist is sent
/// only those a person likes. One wording for both, so a garment is tagged by the same idea of a style it is later chosen by.
/// </summary>
public static class StyleGuide
{
    private static readonly FrozenDictionary<StyleTag, string> Definitions = new Dictionary<StyleTag, string>
    {
        [StyleTag.Casual] =
            "Relaxed everyday clothes with easy fits in cotton, denim and jersey: T-shirts, jeans, sweatshirts and sneakers in any everyday colour. "
            + "Nothing tailored, formal or made for sport.",
        [StyleTag.Smart] =
            "Polished without being formal: neat, well-fitting pieces such as an oxford shirt, a fine knit, chinos or dark jeans, an unstructured blazer, loafers or clean leather sneakers, mostly in navy, grey, white and earth tones. "
            + "No sweatpants, loud graphics or distressed denim, and no full suit.",
        [StyleTag.Elegant] =
            "Dressed up and refined: clean tailored or draped lines in silk, satin, fine wool and polished leather, as in dresses, tailored trousers, blouses, heels and dress shoes, in deep or neutral colours. "
            + "Avoids anything sporty, worn-looking or loudly printed.",
        [StyleTag.Sporty] =
            "Clothes made for movement or borrowed from it: stretch and technical jersey, leggings, track pants, shorts, hoodies, training tops and athletic shoes, often with stripes or logos. "
            + "No tailoring, heels or delicate fabrics.",
        [StyleTag.Streetwear] =
            "Loose, oversized shapes from skate and hip-hop culture: hoodies, graphic T-shirts, cargo and baggy pants, bombers and puffers, caps and statement sneakers, often in black with bold logos or colour blocks. "
            + "Avoids slim tailoring and anything delicate or formal.",
        [StyleTag.Minimalist] =
            "Clean lines, no decoration and a narrow palette of black, white, grey, beige and navy: plain T-shirts and shirts, straight trousers, simple knits and unfussy coats in good fabrics. "
            + "No prints, logos, ruffles or visible hardware.",
        [StyleTag.OldMoney] =
            "Quiet classics that look expensive without showing it: tailored but unfussy cuts in wool, cashmere, linen, cotton poplin and real leather, as in cable knits, oxford shirts, pleated trousers, camel coats and loafers, in cream, beige, navy, brown and forest green. "
            + "No visible logos, synthetics, distressing or anything led by a trend.",
        [StyleTag.Preppy] =
            "Collegiate classics worn neatly: polo and oxford shirts, cable-knit and V-neck sweaters, chinos, pleated skirts, blazers, loafers and boat shoes, in navy, white, red and green with stripes, checks and argyle. "
            + "Avoids oversized, distressed and all-black looks.",
        [StyleTag.Vintage] =
            "Pieces that clearly belong to a past decade, from the 1950s to the 1990s: high waists, flares, retro prints, corduroy, worn denim, suede and old-style leather, in faded or earthy colours. "
            + "Avoids sleek technical fabrics and pieces of the current season.",
        [StyleTag.Y2k] =
            "Pop fashion of the early 2000s: low-rise and flared jeans, baby tees, cropped tops, mini skirts, velour tracksuits, platform shoes and small shoulder bags, in pink, baby blue, metallics and denim, with rhinestones or butterfly prints. "
            + "Avoids muted palettes, long loose layers and classic tailoring.",
        [StyleTag.Boho] =
            "Loose, flowing and layered, with a handmade feel: maxi skirts and dresses, embroidered or crochet tops, fringe, suede, linen and cotton gauze, in earth tones with floral or paisley prints, worn with ankle boots or flat sandals. "
            + "Avoids sharp tailoring, sportswear and shiny synthetics.",
        [StyleTag.Grunge] =
            "Worn-in and deliberately undone, after 1990s rock: plaid flannel shirts, band T-shirts, ripped or faded jeans, oversized knits, leather jackets and combat boots, in black, grey and washed-out colours. "
            + "Avoids anything crisp, preppy or polished.",
        [StyleTag.Gorpcore] =
            "Hiking and outdoor gear worn every day: shell and fleece jackets, puffer vests, technical or cargo pants, base layers, trail shoes and hiking boots, in nylon, fleece and ripstop, in earth tones with an occasional bright accent. "
            + "Avoids tailoring, delicate fabrics and dress shoes.",
        [StyleTag.Business] =
            "Formal office wear: suits, blazers with tailored trousers or pencil skirts, dress shirts and blouses, ties and leather dress shoes, in wool and crisp cotton, in navy, charcoal, grey, black and white. "
            + "No denim, sneakers, sportswear or casual prints.",
        [StyleTag.Romantic] =
            "Soft, delicate and decorative: flowing dresses and skirts, blouses with ruffles, lace, bows or puffed sleeves, in chiffon, silk and fine cotton, in pastels, cream, blush and small florals. "
            + "Avoids hard edges, heavy boots, sportswear and stark all-black looks.",
        [StyleTag.Edgy] =
            "Sharp, dark and a little provocative: black leather and faux leather, studs, zips, chains and other metal hardware, slim or asymmetric cuts, mesh, biker jackets and heavy boots, almost always in black with a little red or silver. "
            + "Avoids pastels, florals and preppy neatness.",
    }.ToFrozenDictionary();

    public static string Of(StyleTag style) => Definitions[style];

    /// <summary>The definitions of the given styles by their codes, each once, in the order given.</summary>
    public static IReadOnlyDictionary<string, string> Notes(IEnumerable<StyleTag> styles)
    {
        // A sorted dictionary would put the codes in alphabetical order; the order given is the order of preference.
        var notes = new Dictionary<string, string>();
        foreach (var style in styles)
        {
            notes.TryAdd(EnumCodes.ToCode(style), Definitions[style]);
        }

        return notes;
    }

    /// <summary>Every style as a line of a Markdown list (<c>- `old_money`: …</c>), in the order of <see cref="StyleTag"/>.</summary>
    public static string AsList()
    {
        var text = new StringBuilder();
        foreach (var style in Enum.GetValues<StyleTag>())
        {
            text.Append("- `").Append(EnumCodes.ToCode(style)).Append("`: ").Append(Definitions[style]).Append('\n');
        }

        return text.ToString().TrimEnd('\n');
    }
}
