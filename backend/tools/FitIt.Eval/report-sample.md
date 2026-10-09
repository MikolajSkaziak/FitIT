# FitIt.Eval: report

Matrix of product spec 6.9: 3 wardrobes (12, 30, 60 garments) x 5 weather bands x 6 occasions = 90 scenarios per stylist.
Configured stylist: `fake-outfit-stylist` (the one `Providers:OutfitStylist` selects; prompt `stylist-v3`). Baseline: the rule-based generator of spec 6.7, on the same scenarios.

The pipeline is the one the API runs (`StylistPipeline`), without the database, the clock or the network. Every answer is checked again here, apart from the pipeline.

## Result

**Hard-rule violations: 0.** The gate is passed.

| Stylist | Scenarios | Answered | `missing_garments` | Hard-rule violations | Valid discovery | Served by fallback | Median ms | p95 ms | Cost USD |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| fake-outfit-stylist | 90 | 89 | 1% (1/90) | 0 | 95% (81/85) | 0% (0/89) | 0.29 | 2.22 | 0.0000 |
| Rule-based generator | 90 | 89 | 1% (1/90) | 0 | 100% (85/85) | 100% (89/89) | 0.26 | 1.83 | 0.0000 |

- **Valid discovery:** of the answers whose candidates included a forgotten garment, the share with at least one outfit that really contains one and is labelled a discovery.
- **Served by fallback:** of the answers, the share the rules composed because the model could not be used. The rule-based generator is the fallback itself, so its share is 100% by definition.
- **`missing_garments`:** the share of scenarios where the wardrobe cannot dress the person; the stylist is not asked and nothing is counted against the day's limit.
- **Time** is the pipeline alone: the filter's work is not in it, a real provider's network time is (and is not measured by the fake).

## By wardrobe

| Stylist | Wardrobe | Scenarios | `missing_garments` | Hard-rule violations | Valid discovery | Served by fallback | Median ms | p95 ms |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| fake-outfit-stylist | 12 | 30 | 3% (1/30) | 0 | 88% (22/25) | 0% (0/29) | 0.87 | 3.05 |
| fake-outfit-stylist | 30 | 30 | 0% (0/30) | 0 | 97% (29/30) | 0% (0/30) | 0.26 | 1.79 |
| fake-outfit-stylist | 60 | 30 | 0% (0/30) | 0 | 100% (30/30) | 0% (0/30) | 0.28 | 0.31 |
| Rule-based generator | 12 | 30 | 3% (1/30) | 0 | 100% (25/25) | 100% (29/29) | 0.85 | 2.25 |
| Rule-based generator | 30 | 30 | 0% (0/30) | 0 | 100% (30/30) | 100% (30/30) | 0.22 | 1.76 |
| Rule-based generator | 60 | 30 | 0% (0/30) | 0 | 100% (30/30) | 100% (30/30) | 0.26 | 0.30 |

## By weather

| Stylist | Weather | Scenarios | `missing_garments` | Hard-rule violations | Valid discovery | Served by fallback | Median ms | p95 ms |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| fake-outfit-stylist | hot (28 °C) | 18 | 0% (0/18) | 0 | 88% (15/17) | 0% (0/18) | 0.27 | 15.85 |
| fake-outfit-stylist | warm (20 °C) | 18 | 0% (0/18) | 0 | 100% (17/17) | 0% (0/18) | 0.27 | 1.64 |
| fake-outfit-stylist | mild (14 °C) | 18 | 0% (0/18) | 0 | 94% (16/17) | 0% (0/18) | 0.28 | 2.30 |
| fake-outfit-stylist | cold (6 °C) | 18 | 0% (0/18) | 0 | 100% (17/17) | 0% (0/18) | 0.30 | 1.65 |
| fake-outfit-stylist | freezing (-5 °C) | 18 | 6% (1/18) | 0 | 94% (16/17) | 0% (0/17) | 0.31 | 3.05 |
| Rule-based generator | hot (28 °C) | 18 | 0% (0/18) | 0 | 100% (17/17) | 100% (18/18) | 0.33 | 1.37 |
| Rule-based generator | warm (20 °C) | 18 | 0% (0/18) | 0 | 100% (17/17) | 100% (18/18) | 0.22 | 1.26 |
| Rule-based generator | mild (14 °C) | 18 | 0% (0/18) | 0 | 100% (17/17) | 100% (18/18) | 0.26 | 2.13 |
| Rule-based generator | cold (6 °C) | 18 | 0% (0/18) | 0 | 100% (17/17) | 100% (18/18) | 0.26 | 1.20 |
| Rule-based generator | freezing (-5 °C) | 18 | 6% (1/18) | 0 | 100% (17/17) | 100% (17/17) | 0.28 | 2.26 |

## Quality of the outfits

| Stylist | Outfits | Mean score | Labelled (sure bet, discovery, new pairing) | Three outfits in an answer |
|---|---:|---:|---:|---:|
| fake-outfit-stylist | 250 | 98.5 | 59% (148/250) | 84% (75/89) |
| Rule-based generator | 259 | 98.4 | 69% (179/259) | 94% (84/89) |

The mean score is the coherence score of spec 6.6 (0 to 100). Whether an outfit is fit to wear is judged by a person, on a sample (goal: at least 70%); that is not measured here.

## Where the wardrobe cannot dress the person (`missing_garments`)

The filter is the same for both stylists, so the list is the same.

| Wardrobe | Weather | Occasion | Lacks (each required) | Lacks (any one of) |
|---:|---|---|---|---|
| 12 | freezing (-5 °C) | Workout | mid_layer |  |

## Violations of the hard rules

None.

## Visualizations

10 different outfits (the first proposal of the first scenarios that were answered) ordered from the image provider `fake-outfit-visualizer`, each waited for through the same three calls the job uses.

| Orders | Completed | Blocked by the filter | Failed | Median s | p95 s | Cost USD |
|---:|---:|---:|---:|---:|---:|---:|
| 10 | 10 | 0 | 0 | 0.000 | 0.007 | 0.0000 |

With the fake provider the time is that of the code alone and the cost is zero; the first real numbers appear when the real provider is plugged in behind the same port.
