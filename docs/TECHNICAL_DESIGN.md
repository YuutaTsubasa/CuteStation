# CuteStation 技術設計文件

## 技術選型

### 遊戲引擎
- PixiJS v8（2D 渲染）
- 自製遊戲邏輯層（物理、碰撞、狀態機）

### 為什麼選 PixiJS
- 高效能 WebGL 渲染，自動 fallback Canvas
- Sprite、動畫、Spritesheet 內建支援
- 輕量，不綁定遊戲邏輯，彈性高
- Tauri + Svelte 整合容易

## 專案架構
```
src/
├── lib/
│   ├── game/
│   │   ├── core/           # 遊戲核心
│   │   │   ├── Game.ts     # 主遊戲迴圈
│   │   │   ├── Scene.ts    # 場景管理
│   │   │   └── Input.ts    # 輸入管理（鍵盤/觸控/手把）
│   │   ├── input/          # 輸入來源（虛擬搖桿）
│   │   ├── entities/       # 遊戲物件
│   │   │   ├── Player.ts   # 玩家角色
│   │   │   ├── Enemy.ts    # 敵人基底類別
│   │   │   └── Collectible.ts # 收集品
│   │   ├── systems/        # 遊戲系統
│   │   │   ├── Physics.ts  # 物理/碰撞
│   │   │   ├── Combat.ts   # 戰鬥系統
│   │   │   └── Camera.ts   # 鏡頭跟隨
│   │   ├── levels/         # 關卡資料
│   │   └── ui/             # 遊戲內 UI（HUD）
│   │
│   ├── pages/              # 頁面系統
│   │   ├── Page.ts         # 頁面基底類別
│   │   ├── SplashScreenPage.ts  # 開場畫面
│   │   ├── MainMenuPage.ts      # 主選單
│   │   ├── GamePlayPage.ts      # 遊戲主畫面
│   │   └── PageManager.ts       # 頁面切換管理
│   │
│   └── components/         # Svelte 元件
│
├── assets/                 # 素材資源
│   ├── sprites/
│   ├── audio/
│   └── levels/
```

## 渲染與解析度

- 設計解析度為 1920x1080（16:9），畫面以等比例縮放至視窗內。
- 16:9 之外的空白區域由 `ProjectContent/UI/gameBackground.png` 補滿。
- DOM UI 與 Pixi 畫面維持同一個設計框，虛擬搖桿作為螢幕空間覆蓋層顯示。
- GamePlay 會先置中鏡頭到玩家起始點，並在角色資產完成載入後才顯示世界層。

## 頁面系統

### 頁面流程
```
SplashScreen → MainMenu → GamePlay
     ↑            │
     └────────────┘
      (返回選單)
```

### 頁面說明
| 頁面 | 功能 |
|------|------|
| SplashScreenPage | 開場 Logo/動畫，自動或點擊進入主選單 |
| MainMenuPage | 開始遊戲、角色選擇、設定（未來）、離開 |
| GamePlayPage | 實際遊戲畫面，載入關卡並執行遊戲邏輯 |

### 未來可擴充頁面
- LevelSelectPage（關卡選擇）
- SettingsPage（設定）
- PausePage（暫停選單）
- ResultPage（過關結算）

## MVP 目標（第一版）

完成「白色宮殿 1-1」可玩關卡：

- [ ] PixiJS 整合到 Svelte
- [ ] 頁面系統（SplashScreen → MainMenu → GamePlay）
- [ ] 角色顯示與基本移動
- [ ] 跳躊機制
- [ ] 基本攻擊
- [ ] Homing Attack
- [ ] 簡易地形碰撞
- [ ] 1 種小怪
- [ ] 5 個收集幣
- [ ] 關卡起點與終點
- [ ] 三種輸入方式（鍵盤、觸控、手把）
- [ ] 基本 UI（生命值、收集幣數量）

## 開發階段

1. PixiJS 整合 + 頁面系統 + SplashScreen + MainMenu 骨架
2. GamePlayPage + 角色顯示 + 移動跳躍
3. 地形碰撞 + 鏡頭
4. 攻擊 + Homing Attack
5. 敵人 + 收集品
6. 輸入系統完善（觸控、手把）
7. 關卡 1-1 完成 + HUD
