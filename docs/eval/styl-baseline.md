# FitIt.Eval: report

Matrix of product spec 6.9: 3 wardrobes (12, 30, 60 garments) x 5 weather bands x 6 occasions x 6 style profiles (casual + smart, old money, streetwear, gorpcore, boho + romantic, sporty) = 540 scenarios per stylist.
This run is a sample of 30 of them: the same ones on every run, spread over the matrix, and only scenarios the wardrobe can dress (see `EvalMatrix.Sample`).
Configured stylist: `gemini-flash-lite-latest` (the one `Providers:OutfitStylist` selects; prompt `stylist-v3`). Baseline: the rule-based generator of spec 6.7, on the same scenarios.

The pipeline is the one the API runs (`StylistPipeline`), without the database, the clock or the network. Every answer is checked again here, apart from the pipeline.

## Result

**Hard-rule violations: 0.** The gate is passed.

| Stylist | Scenarios | Answered | `missing_garments` | Hard-rule violations | Valid discovery | Served by fallback | Median ms | p95 ms | Cost USD |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| gemini-flash-lite-latest | 30 | 30 | 0% (0/30) | 0 | 90% (27/30) | 10% (3/30) | 1720.00 | 22985.27 | 0.0985 |
| Rule-based generator | 30 | 30 | 0% (0/30) | 0 | 97% (29/30) | 100% (30/30) | 0.39 | 3.12 | 0.0000 |

- **Valid discovery:** of the answers whose candidates included a forgotten garment, the share with at least one outfit that really contains one and is labelled a discovery.
- **Served by fallback:** of the answers, the share the rules composed because the model could not be used. The rule-based generator is the fallback itself, so its share is 100% by definition.
- **`missing_garments`:** the share of scenarios where the wardrobe cannot dress the person; the stylist is not asked and nothing is counted against the day's limit.
- **Time** is the pipeline alone: the filter's work is not in it, a real provider's network time is (and is not measured by the fake).

## By wardrobe

| Stylist | Wardrobe | Scenarios | `missing_garments` | Hard-rule violations | Valid discovery | Served by fallback | Median ms | p95 ms |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| gemini-flash-lite-latest | 12 | 9 | 0% (0/9) | 0 | 67% (6/9) | 11% (1/9) | 1755.39 | 3561.14 |
| gemini-flash-lite-latest | 30 | 11 | 0% (0/11) | 0 | 100% (11/11) | 9% (1/11) | 1717.69 | 22985.27 |
| gemini-flash-lite-latest | 60 | 10 | 0% (0/10) | 0 | 100% (10/10) | 10% (1/10) | 1732.00 | 22998.56 |
| Rule-based generator | 12 | 9 | 0% (0/9) | 0 | 89% (8/9) | 100% (9/9) | 0.57 | 3.12 |
| Rule-based generator | 30 | 11 | 0% (0/11) | 0 | 100% (11/11) | 100% (11/11) | 0.39 | 5.79 |
| Rule-based generator | 60 | 10 | 0% (0/10) | 0 | 100% (10/10) | 100% (10/10) | 0.33 | 1.81 |

## By weather

| Stylist | Weather | Scenarios | `missing_garments` | Hard-rule violations | Valid discovery | Served by fallback | Median ms | p95 ms |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| gemini-flash-lite-latest | hot (28 °C) | 6 | 0% (0/6) | 0 | 67% (4/6) | 0% (0/6) | 1620.36 | 2004.92 |
| gemini-flash-lite-latest | warm (20 °C) | 5 | 0% (0/5) | 0 | 100% (5/5) | 0% (0/5) | 1531.06 | 1709.30 |
| gemini-flash-lite-latest | mild (14 °C) | 7 | 0% (0/7) | 0 | 100% (7/7) | 14% (1/7) | 1739.73 | 22985.27 |
| gemini-flash-lite-latest | cold (6 °C) | 6 | 0% (0/6) | 0 | 100% (6/6) | 0% (0/6) | 1811.31 | 1869.23 |
| gemini-flash-lite-latest | freezing (-5 °C) | 6 | 0% (0/6) | 0 | 83% (5/6) | 33% (2/6) | 1784.32 | 22998.56 |
| Rule-based generator | hot (28 °C) | 6 | 0% (0/6) | 0 | 100% (6/6) | 100% (6/6) | 0.34 | 3.12 |
| Rule-based generator | warm (20 °C) | 5 | 0% (0/5) | 0 | 100% (5/5) | 100% (5/5) | 0.52 | 0.95 |
| Rule-based generator | mild (14 °C) | 7 | 0% (0/7) | 0 | 100% (7/7) | 100% (7/7) | 0.34 | 1.90 |
| Rule-based generator | cold (6 °C) | 6 | 0% (0/6) | 0 | 100% (6/6) | 100% (6/6) | 0.30 | 0.67 |
| Rule-based generator | freezing (-5 °C) | 6 | 0% (0/6) | 0 | 83% (5/6) | 100% (6/6) | 0.56 | 5.79 |

## Quality of the outfits

| Stylist | Outfits | Mean score | Labelled (sure bet, discovery, new pairing) | Three outfits in an answer |
|---|---:|---:|---:|---:|
| gemini-flash-lite-latest | 85 | 93.5 | 92% (78/85) | 90% (27/30) |
| Rule-based generator | 89 | 98.4 | 69% (61/89) | 97% (29/30) |

The mean score is the coherence score of spec 6.6 (0 to 100). Whether an outfit is fit to wear is judged by a person, on a sample (goal: at least 70%); that is not measured here.

## Style fidelity

Of the garments of an outfit that carry style tags, the share that carry one of the styles of the person's profile (direct), and the share that carry one of them or a style that goes with one of them by `StyleAffinity` (direct or compatible). Each number is the mean over outfits. The measure lives in `StyleFidelity` in this project and reads nothing the stylist computes.

| Stylist | Profile | Outfits | Direct | Direct or compatible |
|---|---|---:|---:|---:|
| gemini-flash-lite-latest | all | 85 | 31.3 % | 80.4 % |
| gemini-flash-lite-latest | casual + smart | 13 | 80.8 % | 100.0 % |
| gemini-flash-lite-latest | old money | 13 | 11.9 % | 63.2 % |
| gemini-flash-lite-latest | streetwear | 14 | 27.6 % | 69.2 % |
| gemini-flash-lite-latest | gorpcore | 15 | 20.2 % | 72.3 % |
| gemini-flash-lite-latest | boho + romantic | 15 | 21.8 % | 93.7 % |
| gemini-flash-lite-latest | sporty | 15 | 29.3 % | 83.6 % |
| Rule-based generator | all | 89 | 31.3 % | 79.1 % |
| Rule-based generator | casual + smart | 15 | 90.2 % | 100.0 % |
| Rule-based generator | old money | 15 | 5.3 % | 45.2 % |
| Rule-based generator | streetwear | 14 | 34.2 % | 77.0 % |
| Rule-based generator | gorpcore | 15 | 20.4 % | 84.8 % |
| Rule-based generator | boho + romantic | 15 | 13.9 % | 86.9 % |
| Rule-based generator | sporty | 15 | 23.9 % | 80.3 % |

| Stylist | Wardrobe | Outfits | Direct | Direct or compatible |
|---|---:|---:|---:|---:|
| gemini-flash-lite-latest | 12 | 22 | 29.1 % | 82.5 % |
| gemini-flash-lite-latest | 30 | 33 | 37.1 % | 84.7 % |
| gemini-flash-lite-latest | 60 | 30 | 26.6 % | 74.1 % |
| Rule-based generator | 12 | 26 | 29.0 % | 81.9 % |
| Rule-based generator | 30 | 33 | 32.2 % | 79.3 % |
| Rule-based generator | 60 | 30 | 32.3 % | 76.3 % |

## Requests to the model

| Stylist | Answers | Requests | Retries | Mean input tokens | Mean output tokens | Mean thought tokens | Mean cost per request USD | Mean cost per answer USD | Cost USD |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| gemini-flash-lite-latest | 30 | 31 | 1 | 2466 | 354 | 0 | 0.003176 | 0.003282 | 0.0985 |
| Rule-based generator | 30 | 0 | 0 | n/a | n/a | n/a | n/a | 0.000000 | 0.0000 |

A request is one question put to the model; a retry is the second question of an answer whose first try held no valid outfit. Tokens are the provider's own counts (thinking is charged like output); the cost is those counts at the configured prices. A fake stylist and the rules ask nothing and cost nothing.

## Where the wardrobe cannot dress the person (`missing_garments`)

None.

## Violations of the hard rules

None.

## The sampled answers

What `gemini-flash-lite-latest` proposed, case by case, for reading by a person. Each garment is followed by its style tags.

**12 garments, hot (28 °C), Everyday, casual + smart**

- sure_bet, score 90, direct 100 %: Black T-shirt [casual, streetwear]; Blue jeans [casual, streetwear]; White sneakers [casual, streetwear]
  - A black cotton t-shirt paired with blue denim jeans and white leather sneakers creates a classic, comfortable look for a warm everyday outing.

**12 garments, cold (6 °C), Date, old money**

- sure_bet, score 95, direct 25 %: Navy oxford shirt [smart, elegant]; Blue jeans [casual, streetwear]; Beige wool coat [elegant, smart, old_money]; Brown ankle boots [smart, casual]
  - The navy shirt and blue jeans create a classic base, paired with a warm beige wool coat and brown ankle boots for an elegant evening look.
- discovery, score 95, direct 20 %: White T-shirt [casual, minimalist]; Burgundy wool sweater [smart, casual]; Blue jeans [casual, streetwear]; Beige wool coat [elegant, smart, old_money]; Brown ankle boots [smart, casual]
  - This outfit brings in the forgotten burgundy wool sweater under a refined beige coat and blue jeans, balancing comfort with sophisticated evening style.
- new_pairing, score 95, direct 20 %: Black T-shirt [casual, streetwear]; Cream sweater [casual, smart]; Blue jeans [casual, streetwear]; Beige wool coat [elegant, smart, old_money]; Brown ankle boots [smart, casual]
  - A black t-shirt layered under a cream knit sweater offers a chic contrast with blue jeans, finished with the beige wool coat.

**30 garments, mild (14 °C), Everyday, streetwear**

- sure_bet, score 100, direct 75 %: Black T-shirt [casual, streetwear]; Gray hoodie [casual, streetwear, sporty]; Black jeans [casual, smart, grunge]; White sneakers [casual, streetwear]
  - The black t-shirt and jeans create an effortless streetwear base, paired with a grey hoodie for comfort and white leather sneakers.
- discovery, score 95, direct 25 %: White T-shirt [casual, minimalist]; Cream sweater [casual, smart]; Blue jeans [casual, streetwear]; Brown hiking boots [gorpcore]
  - This outfit pairs the forgotten white t-shirt and blue denim jeans with a cozy cream knit sweater and brown ankle boots for an easy everyday look.
- new_pairing, score 95, direct 50 %: Olive technical long-sleeve top [gorpcore, sporty]; Gray hiking pants [gorpcore, sporty]; Olive parka [casual, streetwear, gorpcore]; White sneakers [casual, streetwear]
  - Olive green and grey tones blend into a practical streetwear style with an olive parka and white sneakers.

**60 garments, hot (28 °C), Date, gorpcore**

- sure_bet, score 100, direct 0 %: Navy oxford shirt [smart, elegant]; Beige chinos [smart, casual]; Brown leather loafers [old_money, preppy, smart]; Woven straw bag [boho]
  - The navy cotton shirt and beige chinos create an elegant and smart casual look for your evening out. Brown leather loafers and a beige handbag tie the warm neutral tones together nicely.
- discovery, score 95, direct 0 %: Light blue striped shirt [smart, casual]; Cream pleated trousers [old_money, elegant]; Brown suede loafers [smart, elegant, old_money, preppy]
  - The striped cotton shirt brings a forgotten piece into rotation, matched with cream wool trousers for an elevated evening style. Brown suede loafers complete the refined aesthetic.
- new_pairing, score 100, direct 0 %: White linen shirt [old_money, minimalist, smart]; Gray dress pants [smart, elegant]; Brown leather loafers [old_money, preppy, smart]
  - The white linen shirt and grey wool trousers form a fresh, elegant pairing for a warm date night. Brown leather loafers add a polished finish to the outfit.

**60 garments, freezing (-5 °C), Everyday, boho + romantic**

- sure_bet, score 95, direct 17 %: Black turtleneck [smart, elegant, minimalist]; Brown crochet cardigan [boho, vintage]; Beige chinos [smart, casual]; Black down jacket [casual, sporty]; Brown ankle boots [smart, casual]; Black beanie [casual]
  - The black turtleneck and beige chinos create an everyday base, while the brown patterned cardigan adds a touch of romantic texture. The down jacket and warm leather boots keep you comfortable in sub-zero temperatures.
- discovery, score 100, direct 0 %: Light blue striped shirt [smart, casual]; Cream cable-knit sweater [old_money, preppy]; Light blue flared jeans [y2k, vintage]; Olive parka [casual, streetwear, gorpcore]; Brown hiking boots [gorpcore]; Gray wool scarf [casual, smart]
  - This look puts a forgotten striped cotton shirt and cream wool sweater together with light blue jeans for a fresh look. The grey wool scarf and brown ankle boots bring a cozy, boho feel.
- new_pairing, score 100, direct 50 %: Cream embroidered blouse [boho, romantic]; Cream sweater [casual, smart]; Black jeans [casual, smart, grunge]; Olive parka [casual, streetwear, gorpcore]; Tan suede ankle boots [boho, vintage]; Woven straw bag [boho]
  - The cream patterned blouse and cream knit sweater pair with black denim jeans for a clean contrast. Beige suede ankle boots and the olive green parka complete the smart casual look.

**12 garments, mild (14 °C), Date, sporty**

- sure_bet, score 95, direct 0 %: Navy oxford shirt [smart, elegant]; Cream sweater [casual, smart]; Blue jeans [casual, streetwear]; Brown ankle boots [smart, casual]
  - You pair a navy blue shirt with a warm cream sweater and blue denim jeans for a smart and comfortable evening look.
- discovery, score 100, direct 0 %: Navy oxford shirt [smart, elegant]; Burgundy wool sweater [smart, casual]; Black jeans [casual, smart, grunge]; Brown ankle boots [smart, casual]
  - You style a forgotten burgundy wool sweater with a navy shirt and black jeans for a refined date night outfit.
- no kind, score 40, direct 0 %: Cream sweater [casual, smart]; Navy dress [elegant, smart]; Beige wool coat [elegant, smart, old_money]; Brown ankle boots [smart, casual]
  - You combine a navy dress with a beige wool coat and brown ankle boots for an elegant evening out.

**30 garments, warm (20 °C), Work, casual + smart**

- sure_bet, score 95, direct 75 %: Navy oxford shirt [smart, elegant]; Blue jeans [casual, streetwear]; White sneakers [casual, streetwear]; Woven straw bag [boho]
  - You get a classic and reliable combination with the navy cotton shirt and blue denim jeans, finished with clean white leather sneakers for a smooth smart casual look.
- discovery, score 100, direct 67 %: Light blue striped shirt [smart, casual]; Beige chinos [smart, casual]; Tan suede ankle boots [boho, vintage]
  - You can bring out the forgotten striped cotton shirt by pairing it with beige cotton chinos and beige suede ankle boots for a coordinated and easygoing style.
- new_pairing, score 95, direct 67 %: Cream embroidered blouse [boho, romantic]; Gray dress pants [smart, elegant]; White sneakers [casual, streetwear]
  - You create a fresh look by matching the cream patterned cotton blouse with grey wool trousers, balanced out nicely by white leather sneakers.

**30 garments, freezing (-5 °C), Friends, old money**

- sure_bet, score 90, direct 0 %: Cream embroidered blouse [boho, romantic]; Cream sweater [casual, smart]; Blue jeans [casual, streetwear]; Black down jacket [casual, sporty]; Brown hiking boots [gorpcore]; Gray wool scarf [casual, smart]
  - The cream blouse and matching knit sweater create a warm, classic palette paired with classic blue jeans for a relaxed outing with friends.
- discovery, score 100, direct 0 %: Light blue striped shirt [smart, casual]; Burgundy wool sweater [smart, casual]; Beige chinos [smart, casual]; Black down jacket [casual, sporty]; Brown ankle boots [smart, casual]
  - The forgotten burgundy sweater and striped shirt bring a refined, preppy touch to beige chinos and brown boots.
- new_pairing, score 95, direct 0 %: Black T-shirt [casual, streetwear]; Cream sweater [casual, smart]; Black jeans [casual, smart, grunge]; Olive parka [casual, streetwear, gorpcore]; Brown hiking boots [gorpcore]; Gray wool scarf [casual, smart]
  - A black t-shirt and black jeans form a sleek monochrome base under a cozy cream knit sweater and olive parka.

**60 garments, cold (6 °C), Work, streetwear**

- sure_bet, score 95, direct 20 %: Black turtleneck [smart, elegant, minimalist]; Light blue flared jeans [y2k, vintage]; Olive parka [casual, streetwear, gorpcore]; Tan suede ankle boots [boho, vintage]; Woven straw bag [boho]
  - You can rely on this black knit turtleneck and light blue denim jeans for a comfortable streetwear look, finished with a warm olive parka.
- discovery, score 100, direct 17 %: White T-shirt [casual, minimalist]; Burgundy wool sweater [smart, casual]; Blue jeans [casual, streetwear]; Beige wool coat [elegant, smart, old_money]; Brown ankle boots [smart, casual]; Gray wool scarf [casual, smart]
  - This outfit brings back your forgotten white cotton t-shirt and pairs it with a burgundy wool sweater and blue denim jeans for a relaxed vibe.
- new_pairing, score 65, direct 25 %: Pink baby tee [y2k]; Black jeans [casual, smart, grunge]; Navy quilted jacket [old_money, preppy]; White sneakers [casual, streetwear]
  - The pink printed t-shirt adds a bright touch against black denim jeans, complemented by a navy jacket and clean white sneakers.

**12 garments, warm (20 °C), Friends, gorpcore**

- sure_bet, score 90, direct 0 %: Black T-shirt [casual, streetwear]; Blue jeans [casual, streetwear]; White sneakers [casual, streetwear]
  - The black t-shirt and blue denim jeans keep things simple and comfortable for hanging out with friends.
- discovery, score 95, direct 0 %: White T-shirt [casual, minimalist]; Black jeans [casual, smart, grunge]; White sneakers [casual, streetwear]
  - You get to wear the white cotton t-shirt with black denim jeans for a clean monochromatic look.
- new_pairing, score 100, direct 0 %: Black T-shirt [casual, streetwear]; Black jeans [casual, smart, grunge]; Brown ankle boots [smart, casual]
  - Black top and black denim paired with brown ankle boots give a slightly sharper edge to your casual day.

**30 garments, hot (28 °C), Work, boho + romantic**

- no kind, score 95, direct 50 %: Cream embroidered blouse [boho, romantic]; Beige chinos [smart, casual]; White sneakers [casual, streetwear]; Woven straw bag [boho]
  - The cream patterned blouse and beige chinos create an effortless and light look that fits a warm day at work or school.
- discovery, score 95, direct 33 %: Light blue striped shirt [smart, casual]; Blue jeans [casual, streetwear]; Tan suede ankle boots [boho, vintage]
  - The forgotten striped shirt pairs naturally with blue denim for a relaxed yet put together aesthetic.
- no kind, score 100, direct 67 %: Cream floral maxi dress [boho, romantic]; White sneakers [casual, streetwear]; Woven straw bag [boho]
  - This floral cotton dress brings a romantic touch while keeping you cool and comfortable for the office or class.

**30 garments, cold (6 °C), Friends, sporty**

- sure_bet, score 95, direct 33 %: Olive technical long-sleeve top [gorpcore, sporty]; Gray hoodie [casual, streetwear, sporty]; Black jeans [casual, smart, grunge]; Olive parka [casual, streetwear, gorpcore]; White sneakers [casual, streetwear]; Woven straw bag [boho]
  - You get a sporty look with the olive green top, grey hoodie, and black denim jeans, kept warm by the parka and white sneakers.
- discovery, score 100, direct 40 %: White T-shirt [casual, minimalist]; Green fleece pullover [gorpcore, casual]; Gray hiking pants [gorpcore, sporty]; Green shell jacket [gorpcore, sporty]; Brown hiking boots [gorpcore]
  - The forgotten green jacket and green sweatshirt create a cohesive color story paired with grey trousers and brown ankle boots.
- new_pairing, score 95, direct 0 %: Black T-shirt [casual, streetwear]; Cream sweater [casual, smart]; Blue jeans [casual, streetwear]; Brown suede fringe jacket [boho, vintage]; White sneakers [casual, streetwear]
  - A black t-shirt and blue denim jeans form a fresh casual pairing under the cream knit sweater and brown suede jacket.

**60 garments, mild (14 °C), Business, casual + smart**

- no kind, score 95, direct 50 %: White shirt [elegant, smart]; Navy blazer [smart, elegant, business, preppy]; Navy suit pants [elegant, business]; Black dress shoes [elegant, business]
  - The white cotton shirt and navy wool trousers create a sharp and formal silhouette suitable for your business meeting, grounded by classic black leather dress shoes.
- discovery, score 100, direct 75 %: Navy oxford shirt [smart, elegant]; Navy blazer [smart, elegant, business, preppy]; Cream pleated trousers [old_money, elegant]; Brown leather loafers [old_money, preppy, smart]
  - This outfit pairs the forgotten navy wool blazer over a navy shirt and cream wool trousers for a sophisticated yet approachable meeting look.
- new_pairing, score 95, direct 100 %: White shirt [elegant, smart]; Navy blazer [smart, elegant, business, preppy]; Gray dress pants [smart, elegant]; Brown suede loafers [smart, elegant, old_money, preppy]
  - Grey wool trousers paired with the crisp white shirt and the navy wool blazer offer a smart and balanced combination for a professional setting.

**12 garments, hot (28 °C), Workout, old money**

- sure_bet, score 90, direct 0 %: Black T-shirt [casual, streetwear]; Blue jeans [casual, streetwear]; White sneakers [casual, streetwear]
  - You can keep it simple and comfortable for your workout with a classic black t-shirt and blue denim jeans paired with clean white sneakers.

**12 garments, freezing (-5 °C), Business, streetwear** (composed by the rules)

- no kind, score 100, direct 0 %: Burgundy wool sweater [smart, casual]; Navy dress [elegant, smart]; Beige wool coat [elegant, smart, old_money]; Brown ankle boots [smart, casual]
  - An outfit chosen for the weather and the occasion, with colors and style that go together.
- no kind, score 100, direct 0 %: Cream sweater [casual, smart]; Navy dress [elegant, smart]; Beige wool coat [elegant, smart, old_money]; Brown ankle boots [smart, casual]
  - An outfit chosen for the weather and the occasion, with colors and style that go together.

**30 garments, mild (14 °C), Workout, gorpcore** (composed by the rules)

- sure_bet, score 100, direct 75 %: Olive technical long-sleeve top [gorpcore, sporty]; Gray hoodie [casual, streetwear, sporty]; Gray hiking pants [gorpcore, sporty]; Brown hiking boots [gorpcore]
  - These are the pieces you reach for most. They suit the weather and the occasion.
- discovery, score 100, direct 75 %: Olive technical long-sleeve top [gorpcore, sporty]; Gray hiking pants [gorpcore, sporty]; Green shell jacket [gorpcore, sporty]; White sneakers [casual, streetwear]
  - There is something here you have not worn in a while: Green shell jacket. The rest of the outfit suits the weather and the occasion.
- new_pairing, score 100, direct 100 %: Olive technical long-sleeve top [gorpcore, sporty]; Gray hiking pants [gorpcore, sporty]; Green shell jacket [gorpcore, sporty]; Brown hiking boots [gorpcore]
  - You have not worn this top and bottom together yet. It suits the weather and the occasion.

**60 garments, warm (20 °C), Business, boho + romantic**

- sure_bet, score 90, direct 0 %: White shirt [elegant, smart]; Navy suit pants [elegant, business]; Brown suede loafers [smart, elegant, old_money, preppy]
  - The crisp white shirt paired with navy wool trousers creates a sharp and professional look for your business meeting.
- discovery, score 70, direct 0 %: Navy oxford shirt [smart, elegant]; Navy blazer [smart, elegant, business, preppy]; Cream pleated trousers [old_money, elegant]; Brown leather loafers [old_money, preppy, smart]
  - This combination introduces the forgotten navy blue wool blazer over a navy shirt and cream trousers for a sophisticated business style.
- new_pairing, score 100, direct 0 %: White shirt [elegant, smart]; Gray dress pants [smart, elegant]; Black dress shoes [elegant, business]
  - A white shirt and grey wool trousers paired with black leather dress shoes offer a refined, neutral palette suited to the boardroom.

**60 garments, freezing (-5 °C), Workout, sporty** (composed by the rules)

- no kind, score 95, direct 100 %: Olive technical long-sleeve top [gorpcore, sporty]; Black zip hoodie [streetwear, sporty]; Black training leggings [sporty]; Orange insulated parka [gorpcore, sporty]; Gray trail running shoes [gorpcore, sporty]
  - An outfit chosen for the weather and the occasion, with colors and style that go together.
- discovery, score 95, direct 100 %: Olive technical long-sleeve top [gorpcore, sporty]; Gray hoodie [casual, streetwear, sporty]; Gray hiking pants [gorpcore, sporty]; Orange insulated parka [gorpcore, sporty]; Gray trail running shoes [gorpcore, sporty]
  - There is something here you have not worn in a while: Olive technical long-sleeve top. The rest of the outfit suits the weather and the occasion.
- new_pairing, score 95, direct 100 %: Olive technical long-sleeve top [gorpcore, sporty]; Black zip hoodie [streetwear, sporty]; Gray hiking pants [gorpcore, sporty]; Orange insulated parka [gorpcore, sporty]; Gray trail running shoes [gorpcore, sporty]
  - You have not worn this top and bottom together yet. It suits the weather and the occasion.

**12 garments, cold (6 °C), Date, casual + smart**

- sure_bet, score 80, direct 100 %: Navy oxford shirt [smart, elegant]; Cream sweater [casual, smart]; Blue jeans [casual, streetwear]; Beige wool coat [elegant, smart, old_money]; Brown ankle boots [smart, casual]
  - The navy shirt under the cream knit sweater creates an elegant combination with blue denim jeans and brown leather boots for an evening out.
- discovery, score 100, direct 100 %: White T-shirt [casual, minimalist]; Burgundy wool sweater [smart, casual]; Black jeans [casual, smart, grunge]; Beige wool coat [elegant, smart, old_money]; Brown ankle boots [smart, casual]
  - A white t-shirt layered under a burgundy wool sweater brings a fresh contrast, while black denim jeans and brown boots keep the look grounded.
- new_pairing, score 100, direct 100 %: Navy oxford shirt [smart, elegant]; Black jeans [casual, smart, grunge]; Beige wool coat [elegant, smart, old_money]; Brown ankle boots [smart, casual]
  - Pairing the navy cotton shirt with black denim jeans offers a smart casual look that fits right into an evening out.

**30 garments, mild (14 °C), Everyday, old money**

- sure_bet, score 90, direct 0 %: Cream embroidered blouse [boho, romantic]; Cream sweater [casual, smart]; Blue jeans [casual, streetwear]; White sneakers [casual, streetwear]; Woven straw bag [boho]
  - The cream patterned blouse and knit sweater give you an old money feel that works effortlessly with blue denim jeans and white sneakers.
- discovery, score 100, direct 0 %: Light blue striped shirt [smart, casual]; Beige chinos [smart, casual]; Brown suede fringe jacket [boho, vintage]; Tan suede ankle boots [boho, vintage]
  - The forgotten striped cotton shirt pairs smoothly with beige chinos and a brown suede jacket for a polished everyday look.
- new_pairing, score 70, direct 0 %: Black T-shirt [casual, streetwear]; Burgundy wool sweater [smart, casual]; Black jeans [casual, smart, grunge]; Brown suede fringe jacket [boho, vintage]; Brown hiking boots [gorpcore]
  - A black t-shirt under a rich burgundy wool sweater creates a striking contrast against black denim and brown leather boots.

**60 garments, hot (28 °C), Date, streetwear**

- sure_bet, score 100, direct 0 %: White linen shirt [old_money, minimalist, smart]; Cream pleated trousers [old_money, elegant]; Brown leather loafers [old_money, preppy, smart]; Woven straw bag [boho]
  - You can wear the crisp white linen shirt with cream wool trousers and brown leather loafers for an elegant evening look that keeps you cool in the warm weather.
- discovery, score 95, direct 0 %: Light blue striped shirt [smart, casual]; Beige chinos [smart, casual]; Brown suede loafers [smart, elegant, old_money, preppy]; Woven straw bag [boho]
  - The forgotten striped cotton shirt brings a fresh feel when paired with beige chinos and suede loafers, hitting the right notes for a relaxed yet polished date.
- new_pairing, score 95, direct 0 %: Navy oxford shirt [smart, elegant]; Gray dress pants [smart, elegant]; Brown suede loafers [smart, elegant, old_money, preppy]
  - A navy blue cotton shirt paired with grey wool trousers creates a smart, sophisticated outfit that works wonderfully for a summer evening out.

**60 garments, freezing (-5 °C), Everyday, gorpcore**

- sure_bet, score 95, direct 0 %: Black turtleneck [smart, elegant, minimalist]; Cream sweater [casual, smart]; Light blue flared jeans [y2k, vintage]; Black down jacket [casual, sporty]; Brown ankle boots [smart, casual]; Black beanie [casual]
  - You can layer the cream knit sweater over the black turtleneck and pair it with light blue denim jeans for a warm and comfortable everyday look.
- discovery, score 100, direct 33 %: Light blue striped shirt [smart, casual]; Burgundy wool sweater [smart, casual]; Black jeans [casual, smart, grunge]; Olive parka [casual, streetwear, gorpcore]; Brown hiking boots [gorpcore]; Gray wool scarf [casual, smart]
  - The forgotten striped shirt and burgundy wool sweater bring rich texture to your outfit, grounded by black denim jeans and sturdy boots.
- new_pairing, score 100, direct 20 %: Black T-shirt [casual, streetwear]; Brown crochet cardigan [boho, vintage]; Beige chinos [smart, casual]; Orange insulated parka [gorpcore, sporty]; Tan suede ankle boots [boho, vintage]
  - A simple black t-shirt under the brown patterned cardigan pairs nicely with beige chinos and suede boots for an easy outdoor style.

**12 garments, mild (14 °C), Date, boho + romantic**

- sure_bet, score 95, direct 0 %: Navy oxford shirt [smart, elegant]; Blue jeans [casual, streetwear]; Beige wool coat [elegant, smart, old_money]; Brown ankle boots [smart, casual]
  - The navy shirt paired with blue denim creates a cohesive look, while the beige coat adds an elegant layer suitable for an evening out.
- discovery, score 95, direct 0 %: White T-shirt [casual, minimalist]; Burgundy wool sweater [smart, casual]; Blue jeans [casual, streetwear]; Brown ankle boots [smart, casual]
  - The forgotten white t-shirt and burgundy wool sweater bring warmth and a fresh combination to your blue jeans.
- new_pairing, score 95, direct 0 %: Black T-shirt [casual, streetwear]; Cream sweater [casual, smart]; Blue jeans [casual, streetwear]; Brown ankle boots [smart, casual]
  - A cream knit sweater layered over a black t-shirt creates a balanced contrast with blue denim for a smart casual evening.

**30 garments, warm (20 °C), Everyday, sporty**

- sure_bet, score 100, direct 0 %: Black T-shirt [casual, streetwear]; Black jeans [casual, smart, grunge]; White sneakers [casual, streetwear]
  - A black cotton t-shirt and black denim jeans create a simple and reliable look for an everyday outing, completed with white leather sneakers.
- discovery, score 95, direct 0 %: White T-shirt [casual, minimalist]; Blue jeans [casual, streetwear]; White sneakers [casual, streetwear]
  - The forgotten white cotton t-shirt pairs easily with blue denim jeans and white leather sneakers for a fresh, casual style.
- new_pairing, score 100, direct 67 %: Olive technical long-sleeve top [gorpcore, sporty]; Gray hiking pants [gorpcore, sporty]; White sneakers [casual, streetwear]
  - An olive green long-sleeve top and grey synthetic trousers offer a relaxed sporty combination that suits mild daily weather.

**30 garments, freezing (-5 °C), Friends, casual + smart**

- sure_bet, score 100, direct 67 %: Olive technical long-sleeve top [gorpcore, sporty]; Gray hoodie [casual, streetwear, sporty]; Black jeans [casual, smart, grunge]; Black down jacket [casual, sporty]; Brown hiking boots [gorpcore]; Gray wool scarf [casual, smart]
  - You get a reliable and warm combination of black and olive tones that keep you comfortable for a casual day out.
- discovery, score 90, direct 100 %: White T-shirt [casual, minimalist]; Burgundy wool sweater [smart, casual]; Blue jeans [casual, streetwear]; Olive parka [casual, streetwear, gorpcore]; Brown ankle boots [smart, casual]
  - You can revive forgotten pieces like the burgundy wool sweater and white t-shirt under a warm parka and brown boots for a fresh look.
- new_pairing, score 95, direct 50 %: Cream embroidered blouse [boho, romantic]; Cream sweater [casual, smart]; Beige chinos [smart, casual]; Black down jacket [casual, sporty]; Tan suede ankle boots [boho, vintage]; Woven straw bag [boho]
  - You mix cream and beige tones for a smart casual outfit that feels cohesive and stylish for meeting friends.

**60 garments, cold (6 °C), Work, old money**

- sure_bet, score 80, direct 17 %: Black turtleneck [smart, elegant, minimalist]; Cream sweater [casual, smart]; Beige chinos [smart, casual]; Navy quilted jacket [old_money, preppy]; Brown ankle boots [smart, casual]; Woven straw bag [boho]
  - You get a polished look with the black turtleneck and beige chinos, while the cream sweater and navy jacket keep you warm for the day.
- discovery, score 100, direct 33 %: Light blue striped shirt [smart, casual]; Navy blazer [smart, elegant, business, preppy]; Gray dress pants [smart, elegant]; Beige wool coat [elegant, smart, old_money]; Brown leather loafers [old_money, preppy, smart]; Gray wool scarf [casual, smart]
  - Your forgotten striped shirt and grey wool trousers blend seamlessly under the smart beige wool coat for a refined old money aesthetic.
- new_pairing, score 100, direct 40 %: White linen shirt [old_money, minimalist, smart]; Brown crochet cardigan [boho, vintage]; Cream pleated trousers [old_money, elegant]; Olive parka [casual, streetwear, gorpcore]; Tan suede ankle boots [boho, vintage]
  - The white linen shirt paired with cream wool trousers offers a clean, elegant foundation topped by a patterned cardigan and olive parka.

**12 garments, warm (20 °C), Friends, streetwear**

- sure_bet, score 90, direct 100 %: Black T-shirt [casual, streetwear]; Blue jeans [casual, streetwear]; White sneakers [casual, streetwear]
  - The black t-shirt and blue denim jeans keep things simple and casual for hanging out with friends.
- discovery, score 65, direct 25 %: White T-shirt [casual, minimalist]; Burgundy wool sweater [smart, casual]; Blue jeans [casual, streetwear]; Brown ankle boots [smart, casual]
  - This look brings out the burgundy sweater with blue jeans and leather boots for a relaxed afternoon.
- new_pairing, score 65, direct 50 %: Black T-shirt [casual, streetwear]; Cream sweater [casual, smart]; Black jeans [casual, smart, grunge]; White sneakers [casual, streetwear]
  - Black denim jeans paired with the cream knit sweater and black t-shirt create a clean monochrome contrast.

**30 garments, hot (28 °C), Work, gorpcore**

- sure_bet, score 100, direct 0 %: Navy oxford shirt [smart, elegant]; Gray dress pants [smart, elegant]; White sneakers [casual, streetwear]
  - The navy shirt and grey wool trousers create a sharp, professional look that fits the workday well, and the white sneakers keep it grounded and comfortable.
- discovery, score 100, direct 0 %: Light blue striped shirt [smart, casual]; Beige chinos [smart, casual]; Tan suede ankle boots [boho, vintage]; Woven straw bag [boho]
  - The forgotten striped shirt and beige chinos bring a fresh, light pairing to your work day, complemented by the matching beige ankle boots.
- new_pairing, score 90, direct 0 %: Cream embroidered blouse [boho, romantic]; Blue jeans [casual, streetwear]; White sneakers [casual, streetwear]
  - The cream patterned blouse paired with blue denim jeans offers an easy and balanced mix for the classroom or office.

**30 garments, cold (6 °C), Friends, boho + romantic**

- sure_bet, score 90, direct 50 %: Cream embroidered blouse [boho, romantic]; Cream sweater [casual, smart]; Blue jeans [casual, streetwear]; Brown suede fringe jacket [boho, vintage]; Brown hiking boots [gorpcore]; Woven straw bag [boho]
  - Cream and blue denim create an easygoing backdrop for catching up with friends, paired with a warm brown suede jacket.
- discovery, score 80, direct 0 %: Light blue striped shirt [smart, casual]; Burgundy wool sweater [smart, casual]; Black jeans [casual, smart, grunge]; Olive parka [casual, streetwear, gorpcore]; Brown ankle boots [smart, casual]
  - A forgotten burgundy wool sweater brings a rich tone to this look, grounded by black jeans and a striped shirt.
- new_pairing, score 85, direct 60 %: Olive technical long-sleeve top [gorpcore, sporty]; Rust tiered maxi skirt [boho, romantic]; Brown suede fringe jacket [boho, vintage]; White sneakers [casual, streetwear]; Woven straw bag [boho]
  - Olive green and orange floral bring together a romantic and relaxed look that fits right in for hanging out.

**60 garments, mild (14 °C), Work, sporty**

- sure_bet, score 95, direct 0 %: Black turtleneck [smart, elegant, minimalist]; Brown crochet cardigan [boho, vintage]; Light blue flared jeans [y2k, vintage]; Tan suede ankle boots [boho, vintage]; Woven straw bag [boho]
  - The black turtleneck and blue denim jeans keep things simple and comfortable, while the patterned cardigan adds a warm layer.
- discovery, score 100, direct 0 %: Light blue striped shirt [smart, casual]; Beige chinos [smart, casual]; Navy quilted jacket [old_money, preppy]; Brown leather loafers [old_money, preppy, smart]
  - The forgotten striped shirt pairs naturally with beige chinos and a navy jacket for a clean look.
- new_pairing, score 100, direct 0 %: Black T-shirt [casual, streetwear]; Olive cargo pants [streetwear, gorpcore]; Olive parka [casual, streetwear, gorpcore]; White sneakers [casual, streetwear]
  - A black t-shirt and olive green trousers create a relaxed sporty pairing matched with white sneakers.

## Visualizations

Not run.
