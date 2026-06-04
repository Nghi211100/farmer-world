# Kế hoạch chăn nuôi (Livestock)

## Pen / house art (`src/assets/animals/*_house.png`)

| Type | Texture key | File |
|------|-------------|------|
| chicken | `chicken_house` | `chicken_house.png` |
| cow | `cow_house` | `cow_house.png` |
| duck | `duck_house` | `duck_house.png` |
| fish | `fish_house` | `fish_house.png` |
| pig | `pig_house` | `pig_house.png` |
| sheep | `sheep_house` | `sheep_house.png` |
| goat | `goat_house` | (không dùng cho Build — dê/cừu dùng chuồng chung) |
| **ruminant** (dê/cừu) | `sheep_house` | Chuồng Build **Chuồng Dê/Cừu** — một con dê *hoặc* cừu |

Lv1/Lv2 dùng **cùng** house PNG; scene scale theo footprint **3×3** / **4×4**.

## Animal sprites (`src/assets/animals/`)

| Pattern | Meaning |
|---------|---------|
| `{species}_child` | Giai đoạn **child** |
| `{species}_young` | **young** (`pig_young` only) |
| `{species}_ault` / `_ault_N` | **adult**; `ault` = typo for adult trong file gốc |
| `_1`, `_2`, `_3` trong tên | **Biến thể** random khi mua thú |
| `pick_ault.png` | Heo trưởng thành → key `pig_ault` |
| `fish_1`…`fish_4` | Cá — adult variants |

**Species (7):** chicken, goat, cow, duck, fish, pig, sheep.

## Footprint

| Cấp | Ô | Scale |
|-----|---|--------|
| 1 | 3×3 | `penHouseDisplaySize` → **192×96** px (padding **1.0**); `fitSpriteToIsoFootprint` **contain**; anchor bottom-center |
| 2 | 4×4 | **256×128** px (4×64 × 4×32) |

## Chuồng / hồ — Build → Chăn nuôi

- Mua & **đặt** chuồng/hồ footprint **3×3** — `LIVESTOCK_PEN_PLACE_ITEMS` (6 thẻ: 5 loài + **Chuồng Dê/Cừu**).
- Dê và cừu **nuôi chung** một chuồng (`penKind: 'ruminant'`); art chuồng = `sheep_house`.
- `livestockPenLayout.ts`: tọa độ gợi ý dev (6 chuồng, không overlap).

## Vật nuôi — Shop → tab **Vật nuôi**

- `shop_livestock_{species}` — mua thú vào chuồng trống đã đặt từ Build (dê/cừu → chuồng Dê/Cừu, một con).
- Sản phẩm: milk, egg, pork, fish, duck_egg, wool, **goat_milk**.

## Lifecycle mới

- Chu kỳ: **Baby → Growing → Adult → Producing → Hungry → Feed → Producing**.
- Mapping art:
  - `baby/growing` dùng texture stage `child`.
  - `adult/producing/hungry` dùng texture stage `adult` (chuồng có thể tint trạng thái hungry/ready).
  - Stage `young` cũ (nếu có) chỉ là nội bộ/fallback và không hiển thị ra ngoài lifecycle mới.

## Hunger + happiness + economy

- Hunger thresholds:
  - `< 30 phút`: dừng production (pause, chưa trừ happiness).
  - `> 30 phút`: happiness x0.9.
  - `> 60 phút`: happiness x0.75.
  - `> 120 phút`: happiness x0.5.
- Happiness luôn clamp trong `[0..100]`.
- Công thức tác động:
  - `productionSpeedMultiplier = 0.5 + happiness / 200`
  - `productionQtyMultiplier = 0.5 + happiness / 200`
  - `sellPriceMultiplier = 0.5 + happiness / 200`
- Early sell:
  - `<50% growth`: không bán.
  - `50%.. <100%`: 50% `sellBasePrice`.
  - `>=100%`: 100% `sellBasePrice`.
  - Giá bán cuối: `floor(sellBasePrice * growthRate * sellPriceMultiplier)`.

## Feed / output rules

- Feed item theo species:
  - chicken/duck: `corn`
  - fish: `fish_feed`
  - sheep/goat/cow: `grass`
  - pig: `pumpkin`
- Output:
  - chicken → egg
  - duck → duck_egg
  - fish → fish
  - sheep → wool
  - goat → goat_milk
  - pig → pork
  - cow → milk

## Kiểm thử

```bash
npm test
npm run build
```
