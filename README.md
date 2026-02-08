```txt
npm install
npm run dev
```

```txt
npm run deploy
```

[For generating/synchronizing types based on your Worker configuration run](https://developers.cloudflare.com/workers/wrangler/commands/#types):

```txt
npm run cf-typegen
```

Pass the `CloudflareBindings` as generics when instantiation `Hono`:

```ts
// src/index.ts
const app = new Hono<{ Bindings: CloudflareBindings }>()
```


todo!!!!!!!!

``` text  

月令、日辰、动爻、静爻、暗动、伏神、月破、日破、空亡、空亡填实、冲空实空、12 长生、旺相休囚死、进神、退神、六合、六冲、三合、三刑、六害、合处逢冲、冲处逢合、墓库、入墓、出墓、回头生、回头克、伏藏与飞神生克、伏神临日月、伏神有气、六神、六亲、世应关系、爻位、内外卦位置、游魂归魂卦、神煞、太岁、月将、贵人临爻、随鬼入墓、反吟、伏吟、用神忌神权重、动爻与静爻生克。


```