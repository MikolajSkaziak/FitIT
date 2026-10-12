# FitIt.Eval: report

Matrix of product spec 6.9: 3 wardrobes (12, 30, 60 garments) x 5 weather bands x 6 occasions x 6 style profiles (casual + smart, old money, streetwear, gorpcore, boho + romantic, sporty) = 540 scenarios per stylist.
This run is a sample of 30 of them: the same ones on every run, spread over the matrix, and only scenarios the wardrobe can dress (see `EvalMatrix.Sample`).
Configured stylist: `fake-outfit-stylist` (the one `Providers:OutfitStylist` selects; prompt `stylist-v3`). Baseline: the rule-based generator of spec 6.7, on the same scenarios.

The pipeline is the one the API runs (`StylistPipeline`), without the database, the clock or the network. Every answer is checked again here, apart from the pipeline.

## Result

**Hard-rule violations: 0.** The gate is passed.

| Stylist | Scenarios | Answered | `missing_garments` | Hard-rule violations | Valid discovery | Served by fallback | Median ms | p95 ms | Cost USD |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| fake-outfit-stylist | 30 | 30 | 0% (0/30) | 0 | 97% (29/30) | 0% (0/30) | 0.29 | 2.05 | 0.0000 |
| Rule-based generator | 30 | 30 | 0% (0/30) | 0 | 97% (29/30) | 100% (30/30) | 0.23 | 1.30 | 0.0000 |

- **Valid discovery:** of the answers whose candidates included a forgotten garment, the share with at least one outfit that really contains one and is labelled a discovery.
- **Served by fallback:** of the answers, the share the rules composed because the model could not be used. The rule-based generator is the fallback itself, so its share is 100% by definition.
- **`missing_garments`:** the share of scenarios where the wardrobe cannot dress the person; the stylist is not asked and nothing is counted against the day's limit.
- **Time** is the pipeline alone: the filter's work is not in it, a real provider's network time is (and is not measured by the fake).

## By wardrobe

| Stylist | Wardrobe | Scenarios | `missing_garments` | Hard-rule violations | Valid discovery | Served by fallback | Median ms | p95 ms |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| fake-outfit-stylist | 12 | 9 | 0% (0/9) | 0 | 89% (8/9) | 0% (0/9) | 0.33 | 16.32 |
| fake-outfit-stylist | 30 | 11 | 0% (0/11) | 0 | 100% (11/11) | 0% (0/11) | 0.27 | 2.05 |
| fake-outfit-stylist | 60 | 10 | 0% (0/10) | 0 | 100% (10/10) | 0% (0/10) | 0.29 | 1.62 |
| Rule-based generator | 12 | 9 | 0% (0/9) | 0 | 89% (8/9) | 100% (9/9) | 0.34 | 1.12 |
| Rule-based generator | 30 | 11 | 0% (0/11) | 0 | 100% (11/11) | 100% (11/11) | 0.22 | 1.30 |
| Rule-based generator | 60 | 10 | 0% (0/10) | 0 | 100% (10/10) | 100% (10/10) | 0.25 | 1.52 |

## By weather

| Stylist | Weather | Scenarios | `missing_garments` | Hard-rule violations | Valid discovery | Served by fallback | Median ms | p95 ms |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| fake-outfit-stylist | hot (28 °C) | 6 | 0% (0/6) | 0 | 100% (6/6) | 0% (0/6) | 0.28 | 16.32 |
| fake-outfit-stylist | warm (20 °C) | 5 | 0% (0/5) | 0 | 100% (5/5) | 0% (0/5) | 0.26 | 0.34 |
| fake-outfit-stylist | mild (14 °C) | 7 | 0% (0/7) | 0 | 100% (7/7) | 0% (0/7) | 0.27 | 2.05 |
| fake-outfit-stylist | cold (6 °C) | 6 | 0% (0/6) | 0 | 100% (6/6) | 0% (0/6) | 0.28 | 0.32 |
| fake-outfit-stylist | freezing (-5 °C) | 6 | 0% (0/6) | 0 | 83% (5/6) | 0% (0/6) | 0.32 | 1.62 |
| Rule-based generator | hot (28 °C) | 6 | 0% (0/6) | 0 | 100% (6/6) | 100% (6/6) | 0.23 | 1.12 |
| Rule-based generator | warm (20 °C) | 5 | 0% (0/5) | 0 | 100% (5/5) | 100% (5/5) | 0.22 | 0.45 |
| Rule-based generator | mild (14 °C) | 7 | 0% (0/7) | 0 | 100% (7/7) | 100% (7/7) | 0.22 | 1.30 |
| Rule-based generator | cold (6 °C) | 6 | 0% (0/6) | 0 | 100% (6/6) | 100% (6/6) | 0.22 | 0.26 |
| Rule-based generator | freezing (-5 °C) | 6 | 0% (0/6) | 0 | 83% (5/6) | 100% (6/6) | 0.47 | 1.52 |

## Quality of the outfits

| Stylist | Outfits | Mean score | Labelled (sure bet, discovery, new pairing) | Three outfits in an answer |
|---|---:|---:|---:|---:|
| fake-outfit-stylist | 86 | 98.5 | 64% (55/86) | 87% (26/30) |
| Rule-based generator | 89 | 98.4 | 69% (61/89) | 97% (29/30) |

The mean score is the coherence score of spec 6.6 (0 to 100). Whether an outfit is fit to wear is judged by a person, on a sample (goal: at least 70%); that is not measured here.

## Style fidelity

Of the garments of an outfit that carry style tags, the share that carry one of the styles of the person's profile (direct), and the share that carry one of them or a style that goes with one of them by `StyleAffinity` (direct or compatible). Each number is the mean over outfits. The measure lives in `StyleFidelity` in this project and reads nothing the stylist computes.

| Stylist | Profile | Outfits | Direct | Direct or compatible |
|---|---|---:|---:|---:|
| fake-outfit-stylist | all | 86 | 29.1 % | 77.8 % |
| fake-outfit-stylist | casual + smart | 14 | 90.5 % | 100.0 % |
| fake-outfit-stylist | old money | 14 | 9.8 % | 53.1 % |
| fake-outfit-stylist | streetwear | 14 | 21.5 % | 64.9 % |
| fake-outfit-stylist | gorpcore | 15 | 21.9 % | 76.8 % |
| fake-outfit-stylist | boho + romantic | 15 | 9.0 % | 85.9 % |
| fake-outfit-stylist | sporty | 14 | 23.9 % | 85.5 % |
| Rule-based generator | all | 89 | 31.3 % | 79.1 % |
| Rule-based generator | casual + smart | 15 | 90.2 % | 100.0 % |
| Rule-based generator | old money | 15 | 5.3 % | 45.2 % |
| Rule-based generator | streetwear | 14 | 34.2 % | 77.0 % |
| Rule-based generator | gorpcore | 15 | 20.4 % | 84.8 % |
| Rule-based generator | boho + romantic | 15 | 13.9 % | 86.9 % |
| Rule-based generator | sporty | 15 | 23.9 % | 80.3 % |

| Stylist | Wardrobe | Outfits | Direct | Direct or compatible |
|---|---:|---:|---:|---:|
| fake-outfit-stylist | 12 | 24 | 28.1 % | 84.8 % |
| fake-outfit-stylist | 30 | 33 | 31.0 % | 82.0 % |
| fake-outfit-stylist | 60 | 29 | 27.9 % | 67.1 % |
| Rule-based generator | 12 | 26 | 29.0 % | 81.9 % |
| Rule-based generator | 30 | 33 | 32.2 % | 79.3 % |
| Rule-based generator | 60 | 30 | 32.3 % | 76.3 % |

## Requests to the model

| Stylist | Answers | Requests | Retries | Mean input tokens | Mean output tokens | Mean thought tokens | Mean cost per request USD | Mean cost per answer USD | Cost USD |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| fake-outfit-stylist | 30 | 30 | 0 | 0 | 0 | 0 | 0.000000 | 0.000000 | 0.0000 |
| Rule-based generator | 30 | 0 | 0 | n/a | n/a | n/a | n/a | 0.000000 | 0.0000 |

A request is one question put to the model; a retry is the second question of an answer whose first try held no valid outfit. Tokens are the provider's own counts (thinking is charged like output); the cost is those counts at the configured prices. A fake stylist and the rules ask nothing and cost nothing.

## Where the wardrobe cannot dress the person (`missing_garments`)

None.

## Violations of the hard rules

None.

## The sampled answers

What `fake-outfit-stylist` proposed, case by case, for reading by a person. Each garment is followed by its style tags.

**12 garments, hot (28 °C), Everyday, casual + smart**

- no kind, score 95, direct 100 %: Black T-shirt [casual, streetwear]; Black jeans [casual, smart, grunge]; White sneakers [casual, streetwear]
  - An outfit chosen for the weather and the occasion, with colors and style that go together.
- discovery, score 90, direct 100 %: White T-shirt [casual, minimalist]; Blue jeans [casual, streetwear]; White sneakers [casual, streetwear]
  - There is something here you have not worn in a while: White T-shirt. The rest of the outfit suits the weather and the occasion.

**12 garments, cold (6 °C), Date, old money**

- no kind, score 100, direct 0 %: Navy dress [elegant, smart]; Black down jacket [casual, sporty]; Brown ankle boots [smart, casual]
  - An outfit chosen for the weather and the occasion, with colors and style that go together.
- discovery, score 100, direct 20 %: Black T-shirt [casual, streetwear]; Cream sweater [casual, smart]; Black jeans [casual, smart, grunge]; Beige wool coat [elegant, smart, old_money]; Brown ankle boots [smart, casual]
  - There is something here you have not worn in a while: Black jeans. The rest of the outfit suits the weather and the occasion.
- new_pairing, score 95, direct 20 %: White T-shirt [casual, minimalist]; Burgundy wool sweater [smart, casual]; Blue jeans [casual, streetwear]; Beige wool coat [elegant, smart, old_money]; Brown ankle boots [smart, casual]
  - You have not worn this top and bottom together yet. It suits the weather and the occasion.

**30 garments, mild (14 °C), Everyday, streetwear**

- no kind, score 100, direct 20 %: White T-shirt [casual, minimalist]; Gray hoodie [casual, streetwear, sporty]; Gray hiking pants [gorpcore, sporty]; Brown hiking boots [gorpcore]; Gray wool scarf [casual, smart]
  - An outfit chosen for the weather and the occasion, with colors and style that go together.
- discovery, score 100, direct 0 %: Light blue striped shirt [smart, casual]; Cream sweater [casual, smart]; Black jeans [casual, smart, grunge]; Tan suede ankle boots [boho, vintage]; Woven straw bag [boho]
  - There is something here you have not worn in a while: Light blue striped shirt. The rest of the outfit suits the weather and the occasion.
- new_pairing, score 100, direct 25 %: Olive technical long-sleeve top [gorpcore, sporty]; Gray hiking pants [gorpcore, sporty]; Green shell jacket [gorpcore, sporty]; White sneakers [casual, streetwear]
  - You have not worn this top and bottom together yet. It suits the weather and the occasion.

**60 garments, hot (28 °C), Date, gorpcore**

- sure_bet, score 100, direct 0 %: Navy oxford shirt [smart, elegant]; Beige chinos [smart, casual]; Brown leather loafers [old_money, preppy, smart]
  - These are the pieces you reach for most. They suit the weather and the occasion.
- discovery, score 100, direct 0 %: White T-shirt [casual, minimalist]; Light blue flared jeans [y2k, vintage]; Tan suede ankle boots [boho, vintage]; Black beanie [casual]
  - There is something here you have not worn in a while: White T-shirt. The rest of the outfit suits the weather and the occasion.
- new_pairing, score 100, direct 0 %: White graphic T-shirt [streetwear, casual]; Gray dress pants [smart, elegant]; White sneakers [casual, streetwear]; Woven straw bag [boho]
  - You have not worn this top and bottom together yet. It suits the weather and the occasion.

**60 garments, freezing (-5 °C), Everyday, boho + romantic**

- no kind, score 100, direct 20 %: Olive technical long-sleeve top [gorpcore, sporty]; Brown crochet cardigan [boho, vintage]; Black jeans [casual, smart, grunge]; Orange insulated parka [gorpcore, sporty]; Brown hiking boots [gorpcore]
  - An outfit chosen for the weather and the occasion, with colors and style that go together.
- discovery, score 100, direct 0 %: White T-shirt [casual, minimalist]; Cream cable-knit sweater [old_money, preppy]; Black jeans [casual, smart, grunge]; Olive parka [casual, streetwear, gorpcore]; Brown hiking boots [gorpcore]; Black beanie [casual]
  - There is something here you have not worn in a while: White T-shirt. The rest of the outfit suits the weather and the occasion.
- new_pairing, score 100, direct 0 %: Black band T-shirt [grunge, vintage]; Black zip hoodie [streetwear, sporty]; Black training leggings [sporty]; Black down jacket [casual, sporty]; Black high-top sneakers [streetwear, casual]
  - You have not worn this top and bottom together yet. It suits the weather and the occasion.

**12 garments, mild (14 °C), Date, sporty**

- no kind, score 100, direct 0 %: Black T-shirt [casual, streetwear]; Black jeans [casual, smart, grunge]; Beige wool coat [elegant, smart, old_money]; Brown ankle boots [smart, casual]
  - An outfit chosen for the weather and the occasion, with colors and style that go together.
- discovery, score 100, direct 0 %: White T-shirt [casual, minimalist]; Burgundy wool sweater [smart, casual]; Black jeans [casual, smart, grunge]; Brown ankle boots [smart, casual]
  - There is something here you have not worn in a while: White T-shirt. The rest of the outfit suits the weather and the occasion.
- no kind, score 100, direct 0 %: Burgundy wool sweater [smart, casual]; Navy dress [elegant, smart]; Brown ankle boots [smart, casual]
  - An outfit chosen for the weather and the occasion, with colors and style that go together.

**30 garments, warm (20 °C), Work, casual + smart**

- no kind, score 100, direct 75 %: White T-shirt [casual, minimalist]; Black jeans [casual, smart, grunge]; White sneakers [casual, streetwear]; Woven straw bag [boho]
  - An outfit chosen for the weather and the occasion, with colors and style that go together.
- discovery, score 100, direct 75 %: Black T-shirt [casual, streetwear]; Beige chinos [smart, casual]; Tan suede ankle boots [boho, vintage]; Gray wool scarf [casual, smart]
  - There is something here you have not worn in a while: Beige chinos. The rest of the outfit suits the weather and the occasion.
- new_pairing, score 100, direct 75 %: Black T-shirt [casual, streetwear]; Rust tiered maxi skirt [boho, romantic]; White sneakers [casual, streetwear]; Gray wool scarf [casual, smart]
  - You have not worn this top and bottom together yet. It suits the weather and the occasion.

**30 garments, freezing (-5 °C), Friends, old money**

- no kind, score 100, direct 0 %: White T-shirt [casual, minimalist]; Gray hoodie [casual, streetwear, sporty]; Rust tiered maxi skirt [boho, romantic]; Black down jacket [casual, sporty]; Tan suede ankle boots [boho, vintage]; Gray wool scarf [casual, smart]
  - An outfit chosen for the weather and the occasion, with colors and style that go together.
- discovery, score 100, direct 0 %: Black T-shirt [casual, streetwear]; Green fleece pullover [gorpcore, casual]; Beige chinos [smart, casual]; Black down jacket [casual, sporty]; Brown ankle boots [smart, casual]
  - There is something here you have not worn in a while: Green fleece pullover. The rest of the outfit suits the weather and the occasion.
- new_pairing, score 100, direct 0 %: White T-shirt [casual, minimalist]; Burgundy wool sweater [smart, casual]; Beige chinos [smart, casual]; Black down jacket [casual, sporty]; White sneakers [casual, streetwear]; Gray wool scarf [casual, smart]
  - You have not worn this top and bottom together yet. It suits the weather and the occasion.

**60 garments, cold (6 °C), Work, streetwear**

- no kind, score 100, direct 0 %: Navy oxford shirt [smart, elegant]; Cream pleated trousers [old_money, elegant]; Beige wool coat [elegant, smart, old_money]; Brown leather loafers [old_money, preppy, smart]; Woven straw bag [boho]
  - An outfit chosen for the weather and the occasion, with colors and style that go together.
- discovery, score 100, direct 33 %: Black T-shirt [casual, streetwear]; Navy blazer [smart, elegant, business, preppy]; Rust tiered maxi skirt [boho, romantic]; Black bomber jacket [streetwear, casual]; Brown leather loafers [old_money, preppy, smart]; Black beanie [casual]
  - There is something here you have not worn in a while: Navy blazer. The rest of the outfit suits the weather and the occasion.
- new_pairing, score 100, direct 40 %: White graphic T-shirt [streetwear, casual]; Cream cable-knit sweater [old_money, preppy]; Black jeans [casual, smart, grunge]; Brown suede fringe jacket [boho, vintage]; White sneakers [casual, streetwear]
  - You have not worn this top and bottom together yet. It suits the weather and the occasion.

**12 garments, warm (20 °C), Friends, gorpcore**

- no kind, score 100, direct 0 %: White T-shirt [casual, minimalist]; Black jeans [casual, smart, grunge]; Brown ankle boots [smart, casual]
  - An outfit chosen for the weather and the occasion, with colors and style that go together.
- discovery, score 95, direct 0 %: Black T-shirt [casual, streetwear]; Black jeans [casual, smart, grunge]; White sneakers [casual, streetwear]
  - There is something here you have not worn in a while: Black jeans. The rest of the outfit suits the weather and the occasion.
- new_pairing, score 95, direct 0 %: Black T-shirt [casual, streetwear]; Blue jeans [casual, streetwear]; Brown ankle boots [smart, casual]
  - You have not worn this top and bottom together yet. It suits the weather and the occasion.

**30 garments, hot (28 °C), Work, boho + romantic**

- no kind, score 100, direct 50 %: Light blue striped shirt [smart, casual]; Beige chinos [smart, casual]; Tan suede ankle boots [boho, vintage]; Woven straw bag [boho]
  - An outfit chosen for the weather and the occasion, with colors and style that go together.
- discovery, score 100, direct 25 %: Navy oxford shirt [smart, elegant]; Gray dress pants [smart, elegant]; Tan suede ankle boots [boho, vintage]; Gray wool scarf [casual, smart]
  - There is something here you have not worn in a while: Tan suede ankle boots. The rest of the outfit suits the weather and the occasion.
- new_pairing, score 100, direct 0 %: Black T-shirt [casual, streetwear]; Beige chinos [smart, casual]; White sneakers [casual, streetwear]; Gray wool scarf [casual, smart]
  - You have not worn this top and bottom together yet. It suits the weather and the occasion.

**30 garments, cold (6 °C), Friends, sporty**

- no kind, score 100, direct 0 %: White T-shirt [casual, minimalist]; Cream sweater [casual, smart]; Black jeans [casual, smart, grunge]; Brown suede fringe jacket [boho, vintage]; Tan suede ankle boots [boho, vintage]
  - An outfit chosen for the weather and the occasion, with colors and style that go together.
- discovery, score 100, direct 20 %: White T-shirt [casual, minimalist]; Burgundy wool sweater [smart, casual]; Beige chinos [smart, casual]; Green shell jacket [gorpcore, sporty]; White sneakers [casual, streetwear]
  - There is something here you have not worn in a while: White T-shirt. The rest of the outfit suits the weather and the occasion.
- new_pairing, score 100, direct 50 %: Light blue striped shirt [smart, casual]; Gray hiking pants [gorpcore, sporty]; Black down jacket [casual, sporty]; White sneakers [casual, streetwear]
  - You have not worn this top and bottom together yet. It suits the weather and the occasion.

**60 garments, mild (14 °C), Business, casual + smart**

- no kind, score 100, direct 100 %: White shirt [elegant, smart]; Navy blazer [smart, elegant, business, preppy]; Gray dress pants [smart, elegant]; Brown leather loafers [old_money, preppy, smart]
  - An outfit chosen for the weather and the occasion, with colors and style that go together.
- discovery, score 100, direct 75 %: Navy oxford shirt [smart, elegant]; Gray dress pants [smart, elegant]; Beige wool coat [elegant, smart, old_money]; Black dress shoes [elegant, business]
  - There is something here you have not worn in a while: Gray dress pants. The rest of the outfit suits the weather and the occasion.
- no kind, score 100, direct 100 %: Navy blazer [smart, elegant, business, preppy]; Navy dress [elegant, smart]; Brown leather loafers [old_money, preppy, smart]
  - An outfit chosen for the weather and the occasion, with colors and style that go together.

**12 garments, hot (28 °C), Workout, old money**

- no kind, score 95, direct 0 %: Black T-shirt [casual, streetwear]; Black jeans [casual, smart, grunge]; White sneakers [casual, streetwear]
  - An outfit chosen for the weather and the occasion, with colors and style that go together.
- discovery, score 90, direct 0 %: White T-shirt [casual, minimalist]; Blue jeans [casual, streetwear]; White sneakers [casual, streetwear]
  - There is something here you have not worn in a while: White T-shirt. The rest of the outfit suits the weather and the occasion.

**12 garments, freezing (-5 °C), Business, streetwear**

- no kind, score 100, direct 0 %: Burgundy wool sweater [smart, casual]; Navy dress [elegant, smart]; Beige wool coat [elegant, smart, old_money]; Brown ankle boots [smart, casual]
  - An outfit chosen for the weather and the occasion, with colors and style that go together.
- no kind, score 100, direct 0 %: Cream sweater [casual, smart]; Navy dress [elegant, smart]; Beige wool coat [elegant, smart, old_money]; Brown ankle boots [smart, casual]
  - An outfit chosen for the weather and the occasion, with colors and style that go together.

**30 garments, mild (14 °C), Workout, gorpcore**

- no kind, score 100, direct 100 %: Olive technical long-sleeve top [gorpcore, sporty]; Gray hiking pants [gorpcore, sporty]; Green shell jacket [gorpcore, sporty]; Brown hiking boots [gorpcore]
  - An outfit chosen for the weather and the occasion, with colors and style that go together.
- discovery, score 70, direct 60 %: Olive technical long-sleeve top [gorpcore, sporty]; Gray hoodie [casual, streetwear, sporty]; Gray hiking pants [gorpcore, sporty]; Green shell jacket [gorpcore, sporty]; White sneakers [casual, streetwear]
  - There is something here you have not worn in a while: Green shell jacket. The rest of the outfit suits the weather and the occasion.
- new_pairing, score 100, direct 75 %: Olive technical long-sleeve top [gorpcore, sporty]; Gray hoodie [casual, streetwear, sporty]; Gray hiking pants [gorpcore, sporty]; Brown hiking boots [gorpcore]
  - You have not worn this top and bottom together yet. It suits the weather and the occasion.

**60 garments, warm (20 °C), Business, boho + romantic**

- sure_bet, score 100, direct 0 %: White shirt [elegant, smart]; Cream pleated trousers [old_money, elegant]; Brown leather loafers [old_money, preppy, smart]
  - These are the pieces you reach for most. They suit the weather and the occasion.
- discovery, score 100, direct 0 %: Navy dress [elegant, smart]; Black dress shoes [elegant, business]
  - There is something here you have not worn in a while: Navy dress. The rest of the outfit suits the weather and the occasion.
- new_pairing, score 95, direct 0 %: White shirt [elegant, smart]; Navy suit pants [elegant, business]; Black dress shoes [elegant, business]
  - You have not worn this top and bottom together yet. It suits the weather and the occasion.

**60 garments, freezing (-5 °C), Workout, sporty**

- no kind, score 95, direct 100 %: Olive technical long-sleeve top [gorpcore, sporty]; Black zip hoodie [streetwear, sporty]; Black training leggings [sporty]; Orange insulated parka [gorpcore, sporty]; Gray trail running shoes [gorpcore, sporty]
  - An outfit chosen for the weather and the occasion, with colors and style that go together.
- discovery, score 95, direct 100 %: Olive technical long-sleeve top [gorpcore, sporty]; Gray hoodie [casual, streetwear, sporty]; Gray hiking pants [gorpcore, sporty]; Orange insulated parka [gorpcore, sporty]; Gray trail running shoes [gorpcore, sporty]
  - There is something here you have not worn in a while: Olive technical long-sleeve top. The rest of the outfit suits the weather and the occasion.

**12 garments, cold (6 °C), Date, casual + smart**

- no kind, score 100, direct 100 %: Navy dress [elegant, smart]; Black down jacket [casual, sporty]; Brown ankle boots [smart, casual]
  - An outfit chosen for the weather and the occasion, with colors and style that go together.
- discovery, score 100, direct 100 %: Black T-shirt [casual, streetwear]; Cream sweater [casual, smart]; Black jeans [casual, smart, grunge]; Beige wool coat [elegant, smart, old_money]; Brown ankle boots [smart, casual]
  - There is something here you have not worn in a while: Black jeans. The rest of the outfit suits the weather and the occasion.
- new_pairing, score 95, direct 100 %: White T-shirt [casual, minimalist]; Burgundy wool sweater [smart, casual]; Blue jeans [casual, streetwear]; Beige wool coat [elegant, smart, old_money]; Brown ankle boots [smart, casual]
  - You have not worn this top and bottom together yet. It suits the weather and the occasion.

**30 garments, mild (14 °C), Everyday, old money**

- no kind, score 100, direct 0 %: White T-shirt [casual, minimalist]; Gray hoodie [casual, streetwear, sporty]; Gray hiking pants [gorpcore, sporty]; Brown hiking boots [gorpcore]; Gray wool scarf [casual, smart]
  - An outfit chosen for the weather and the occasion, with colors and style that go together.
- discovery, score 100, direct 0 %: Light blue striped shirt [smart, casual]; Cream sweater [casual, smart]; Black jeans [casual, smart, grunge]; Tan suede ankle boots [boho, vintage]; Woven straw bag [boho]
  - There is something here you have not worn in a while: Light blue striped shirt. The rest of the outfit suits the weather and the occasion.
- new_pairing, score 100, direct 0 %: Olive technical long-sleeve top [gorpcore, sporty]; Gray hiking pants [gorpcore, sporty]; Green shell jacket [gorpcore, sporty]; White sneakers [casual, streetwear]
  - You have not worn this top and bottom together yet. It suits the weather and the occasion.

**60 garments, hot (28 °C), Date, streetwear**

- sure_bet, score 100, direct 0 %: Navy oxford shirt [smart, elegant]; Beige chinos [smart, casual]; Brown leather loafers [old_money, preppy, smart]
  - These are the pieces you reach for most. They suit the weather and the occasion.
- discovery, score 100, direct 0 %: White T-shirt [casual, minimalist]; Light blue flared jeans [y2k, vintage]; Tan suede ankle boots [boho, vintage]; Black beanie [casual]
  - There is something here you have not worn in a while: White T-shirt. The rest of the outfit suits the weather and the occasion.
- new_pairing, score 100, direct 50 %: White graphic T-shirt [streetwear, casual]; Gray dress pants [smart, elegant]; White sneakers [casual, streetwear]; Woven straw bag [boho]
  - You have not worn this top and bottom together yet. It suits the weather and the occasion.

**60 garments, freezing (-5 °C), Everyday, gorpcore**

- no kind, score 100, direct 60 %: Olive technical long-sleeve top [gorpcore, sporty]; Brown crochet cardigan [boho, vintage]; Black jeans [casual, smart, grunge]; Orange insulated parka [gorpcore, sporty]; Brown hiking boots [gorpcore]
  - An outfit chosen for the weather and the occasion, with colors and style that go together.
- discovery, score 100, direct 33 %: White T-shirt [casual, minimalist]; Cream cable-knit sweater [old_money, preppy]; Black jeans [casual, smart, grunge]; Olive parka [casual, streetwear, gorpcore]; Brown hiking boots [gorpcore]; Black beanie [casual]
  - There is something here you have not worn in a while: White T-shirt. The rest of the outfit suits the weather and the occasion.
- new_pairing, score 100, direct 0 %: Black band T-shirt [grunge, vintage]; Black zip hoodie [streetwear, sporty]; Black training leggings [sporty]; Black down jacket [casual, sporty]; Black high-top sneakers [streetwear, casual]
  - You have not worn this top and bottom together yet. It suits the weather and the occasion.

**12 garments, mild (14 °C), Date, boho + romantic**

- no kind, score 100, direct 0 %: Black T-shirt [casual, streetwear]; Black jeans [casual, smart, grunge]; Beige wool coat [elegant, smart, old_money]; Brown ankle boots [smart, casual]
  - An outfit chosen for the weather and the occasion, with colors and style that go together.
- discovery, score 100, direct 0 %: White T-shirt [casual, minimalist]; Burgundy wool sweater [smart, casual]; Black jeans [casual, smart, grunge]; Brown ankle boots [smart, casual]
  - There is something here you have not worn in a while: White T-shirt. The rest of the outfit suits the weather and the occasion.
- no kind, score 100, direct 0 %: Burgundy wool sweater [smart, casual]; Navy dress [elegant, smart]; Brown ankle boots [smart, casual]
  - An outfit chosen for the weather and the occasion, with colors and style that go together.

**30 garments, warm (20 °C), Everyday, sporty**

- no kind, score 100, direct 25 %: White T-shirt [casual, minimalist]; Gray hiking pants [gorpcore, sporty]; White sneakers [casual, streetwear]; Gray wool scarf [casual, smart]
  - An outfit chosen for the weather and the occasion, with colors and style that go together.
- discovery, score 95, direct 0 %: Black T-shirt [casual, streetwear]; Blue jeans [casual, streetwear]; Brown ankle boots [smart, casual]; Gray wool scarf [casual, smart]
  - There is something here you have not worn in a while: Brown ankle boots. The rest of the outfit suits the weather and the occasion.
- new_pairing, score 85, direct 40 %: White T-shirt [casual, minimalist]; Gray hoodie [casual, streetwear, sporty]; Gray hiking pants [gorpcore, sporty]; Brown hiking boots [gorpcore]; Gray wool scarf [casual, smart]
  - You have not worn this top and bottom together yet. It suits the weather and the occasion.

**30 garments, freezing (-5 °C), Friends, casual + smart**

- no kind, score 100, direct 67 %: White T-shirt [casual, minimalist]; Gray hoodie [casual, streetwear, sporty]; Rust tiered maxi skirt [boho, romantic]; Black down jacket [casual, sporty]; Tan suede ankle boots [boho, vintage]; Gray wool scarf [casual, smart]
  - An outfit chosen for the weather and the occasion, with colors and style that go together.
- discovery, score 100, direct 100 %: Black T-shirt [casual, streetwear]; Green fleece pullover [gorpcore, casual]; Beige chinos [smart, casual]; Black down jacket [casual, sporty]; Brown ankle boots [smart, casual]
  - There is something here you have not worn in a while: Green fleece pullover. The rest of the outfit suits the weather and the occasion.
- new_pairing, score 100, direct 100 %: White T-shirt [casual, minimalist]; Burgundy wool sweater [smart, casual]; Beige chinos [smart, casual]; Black down jacket [casual, sporty]; White sneakers [casual, streetwear]; Gray wool scarf [casual, smart]
  - You have not worn this top and bottom together yet. It suits the weather and the occasion.

**60 garments, cold (6 °C), Work, old money**

- no kind, score 100, direct 60 %: Navy oxford shirt [smart, elegant]; Cream pleated trousers [old_money, elegant]; Beige wool coat [elegant, smart, old_money]; Brown leather loafers [old_money, preppy, smart]; Woven straw bag [boho]
  - An outfit chosen for the weather and the occasion, with colors and style that go together.
- discovery, score 100, direct 17 %: Black T-shirt [casual, streetwear]; Navy blazer [smart, elegant, business, preppy]; Rust tiered maxi skirt [boho, romantic]; Black bomber jacket [streetwear, casual]; Brown leather loafers [old_money, preppy, smart]; Black beanie [casual]
  - There is something here you have not worn in a while: Navy blazer. The rest of the outfit suits the weather and the occasion.
- new_pairing, score 100, direct 20 %: White graphic T-shirt [streetwear, casual]; Cream cable-knit sweater [old_money, preppy]; Black jeans [casual, smart, grunge]; Brown suede fringe jacket [boho, vintage]; White sneakers [casual, streetwear]
  - You have not worn this top and bottom together yet. It suits the weather and the occasion.

**12 garments, warm (20 °C), Friends, streetwear**

- no kind, score 100, direct 0 %: White T-shirt [casual, minimalist]; Black jeans [casual, smart, grunge]; Brown ankle boots [smart, casual]
  - An outfit chosen for the weather and the occasion, with colors and style that go together.
- discovery, score 95, direct 67 %: Black T-shirt [casual, streetwear]; Black jeans [casual, smart, grunge]; White sneakers [casual, streetwear]
  - There is something here you have not worn in a while: Black jeans. The rest of the outfit suits the weather and the occasion.
- new_pairing, score 95, direct 67 %: Black T-shirt [casual, streetwear]; Blue jeans [casual, streetwear]; Brown ankle boots [smart, casual]
  - You have not worn this top and bottom together yet. It suits the weather and the occasion.

**30 garments, hot (28 °C), Work, gorpcore**

- no kind, score 100, direct 0 %: Light blue striped shirt [smart, casual]; Beige chinos [smart, casual]; Tan suede ankle boots [boho, vintage]; Woven straw bag [boho]
  - An outfit chosen for the weather and the occasion, with colors and style that go together.
- discovery, score 100, direct 0 %: Navy oxford shirt [smart, elegant]; Gray dress pants [smart, elegant]; Tan suede ankle boots [boho, vintage]; Gray wool scarf [casual, smart]
  - There is something here you have not worn in a while: Tan suede ankle boots. The rest of the outfit suits the weather and the occasion.
- new_pairing, score 100, direct 0 %: Black T-shirt [casual, streetwear]; Beige chinos [smart, casual]; White sneakers [casual, streetwear]; Gray wool scarf [casual, smart]
  - You have not worn this top and bottom together yet. It suits the weather and the occasion.

**30 garments, cold (6 °C), Friends, boho + romantic**

- no kind, score 100, direct 40 %: White T-shirt [casual, minimalist]; Cream sweater [casual, smart]; Black jeans [casual, smart, grunge]; Brown suede fringe jacket [boho, vintage]; Tan suede ankle boots [boho, vintage]
  - An outfit chosen for the weather and the occasion, with colors and style that go together.
- discovery, score 100, direct 0 %: White T-shirt [casual, minimalist]; Burgundy wool sweater [smart, casual]; Beige chinos [smart, casual]; Green shell jacket [gorpcore, sporty]; White sneakers [casual, streetwear]
  - There is something here you have not worn in a while: White T-shirt. The rest of the outfit suits the weather and the occasion.
- new_pairing, score 100, direct 0 %: Light blue striped shirt [smart, casual]; Gray hiking pants [gorpcore, sporty]; Black down jacket [casual, sporty]; White sneakers [casual, streetwear]
  - You have not worn this top and bottom together yet. It suits the weather and the occasion.

**60 garments, mild (14 °C), Work, sporty**

- no kind, score 100, direct 0 %: White linen shirt [old_money, minimalist, smart]; Cream sweater [casual, smart]; Olive cargo pants [streetwear, gorpcore]; White sneakers [casual, streetwear]; Gray wool scarf [casual, smart]
  - An outfit chosen for the weather and the occasion, with colors and style that go together.
- discovery, score 100, direct 0 %: Cream embroidered blouse [boho, romantic]; Navy blazer [smart, elegant, business, preppy]; Cream pleated trousers [old_money, elegant]; Black high-top sneakers [streetwear, casual]; Woven straw bag [boho]
  - There is something here you have not worn in a while: Navy blazer. The rest of the outfit suits the weather and the occasion.
- new_pairing, score 100, direct 0 %: White graphic T-shirt [streetwear, casual]; Cream sweater [casual, smart]; Gray dress pants [smart, elegant]; Black high-top sneakers [streetwear, casual]
  - You have not worn this top and bottom together yet. It suits the weather and the occasion.

## Visualizations

Not run.
