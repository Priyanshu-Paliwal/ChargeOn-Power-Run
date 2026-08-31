# Project Structure

The following tree represents the complete folder and file structure for the **ChargeOn Power Run Game** repository, omitting `node_modules`, `.git`, and `dist` directories.

```text
├── .claude
│   └── settings.local.json
├── .gitattributes
├── .gitignore
├── docs
│   ├── Character-Images.png
│   ├── ChargeOn_Power_Run_Content_Script (1).docx
│   ├── ChargeOn_Power_Run_Simple_Overview (1).docx
│   ├── google_apps_script.js
│   ├── IMPLEMENTATION_PLAN.md
│   ├── initial_implementation_documentation.md
│   ├── PROCESS_TRACKER.md
│   ├── PROJECT_STRUCTURE.md
│   └── second_implementation.md
├── index.html
├── package-lock.json
├── package.json
├── public
│   ├── assets
│   │   ├── character-new
│   │   ├── characters
│   │   │   ├── animations.glb
│   │   │   ├── anime_tech.glb
│   │   │   ├── anime_wizard.glb
│   │   │   ├── businessman_character_ankit_rigged.glb
│   │   │   ├── dog
│   │   │   │   ├── source
│   │   │   │   │   └── dog.glb
│   │   │   │   └── textures
│   │   │   │       ├── dog_color.png_1.png
│   │   │   │       └── dog_normal.png_0.png
│   │   │   ├── female-phone-walking-free-animation-40f-loop
│   │   │   │   ├── source
│   │   │   │   │   ├── extracted
│   │   │   │   │   │   ├── locom_f_phoneWalking_40f.fbx
│   │   │   │   │   │   └── peopleColors.png
│   │   │   │   │   └── locom_f_phoneWalking_40f.zip
│   │   │   │   └── textures
│   │   │   │       └── peopleColors.png
│   │   │   ├── female_suit.glb
│   │   │   ├── flamingo
│   │   │   │   └── source
│   │   │   │       └── Flamingo.glb
│   │   │   ├── male-basic-walk-30-frames-loop
│   │   │   │   ├── source
│   │   │   │   │   ├── extracted
│   │   │   │   │   │   ├── locom_m_basicWalk_30f.fbx
│   │   │   │   │   │   └── peopleColors.png
│   │   │   │   │   └── locom_m_basicWalk_30f.zip
│   │   │   │   └── textures
│   │   │   │       └── peopleColors.png
│   │   │   ├── male-phone-walking-40-frames-loop
│   │   │   │   ├── source
│   │   │   │   │   ├── extracted
│   │   │   │   │   │   ├── locom_m_phoneWalking_40f.fbx
│   │   │   │   │   │   └── peopleColors.png
│   │   │   │   │   └── locom_m_phoneWalking_40f.zip
│   │   │   │   └── textures
│   │   │   │       └── peopleColors.png
│   │   │   ├── male-slow-walk-40-frames-loop
│   │   │   │   ├── source
│   │   │   │   │   ├── extracted
│   │   │   │   │   │   ├── locom_m_slowWalk_40f.fbx
│   │   │   │   │   │   └── peopleColors.png
│   │   │   │   │   └── locom_m_slowWalk_40f.zip
│   │   │   │   └── textures
│   │   │   │       └── peopleColors.png
│   │   │   ├── male_character_ps1-style.glb
│   │   │   ├── male_suit.glb
│   │   │   ├── motions
│   │   │   │   ├── Flying.fbx
│   │   │   │   ├── jogging.fbx
│   │   │   │   ├── Looking.fbx
│   │   │   │   ├── Pacing_And_Talking_On_A_Phone_backwards_forwards.fbx
│   │   │   │   ├── Sitting_clap.fbx
│   │   │   │   ├── sitting_leg_movement.fbx
│   │   │   │   ├── strut_walking.fbx
│   │   │   │   ├── talking_phone_pacing.fbx
│   │   │   │   ├── walking.fbx
│   │   │   │   ├── walking_while_texting.fbx
│   │   │   │   └── Waving.fbx
│   │   │   └── thalapathy_vijay_3d_model.glb
│   │   ├── JetpackModel
│   │   │   ├── JetpackModel.bin
│   │   │   └── JetpackModel.gltf
│   │   ├── models
│   │   │   ├── buildings
│   │   │   │   ├── BurgerBuilding.glb
│   │   │   │   ├── CafeBuilding.glb
│   │   │   │   ├── Cinema.glb
│   │   │   │   ├── PizzaBuilding.glb
│   │   │   │   ├── PublicBuilding_1.glb
│   │   │   │   ├── PublicBuilding_10.glb
│   │   │   │   ├── PublicBuilding_2.glb
│   │   │   │   ├── PublicBuilding_3.glb
│   │   │   │   ├── PublicBuilding_4.glb
│   │   │   │   ├── PublicBuilding_5.glb
│   │   │   │   ├── PublicBuilding_6.glb
│   │   │   │   ├── PublicBuilding_7.glb
│   │   │   │   ├── PublicBuilding_8.glb
│   │   │   │   ├── PublicBuilding_9.glb
│   │   │   │   ├── RestaurantBuilding.glb
│   │   │   │   ├── ShopBuilding.glb
│   │   │   │   └── ShoppingCenterBuilding.glb
│   │   │   ├── environment
│   │   │   │   ├── Desert_field.glb
│   │   │   │   ├── MetalRailing.glb
│   │   │   │   └── props
│   │   │   │       ├── atm.glb
│   │   │   │       ├── bench.glb
│   │   │   │       ├── bus_stop.glb
│   │   │   │       ├── coffee_food_cart.glb
│   │   │   │       ├── hydrant.glb
│   │   │   │       ├── ice_cream_food_cart.glb
│   │   │   │       ├── manhole.glb
│   │   │   │       ├── pallet.glb
│   │   │   │       ├── postbox.glb
│   │   │   │       ├── stop_sign.glb
│   │   │   │       ├── storm_drain.glb
│   │   │   │       ├── trash_large.glb
│   │   │   │       ├── trash_small.glb
│   │   │   │       └── utility_box.glb
│   │   │   └── trees
│   │   │       └── airport_plant.glb
│   │   └── textures
│   ├── audio
│   │   ├── music-loop.wav
│   │   └── sfx-sprite.wav
│   ├── draco
│   │   ├── draco_decoder.js
│   │   ├── draco_decoder.wasm
│   │   └── draco_wasm_wrapper.js
│   ├── img
│   │   ├── chargeon-logo-badge.webp
│   │   ├── chargeon-Logo.webp
│   │   └── cyntexa-badge.svg
│   └── textures
│       ├── asphalt_normal.jpg
│       ├── grass_diffuse.jpg
│       ├── grass_normal.jpg
│       ├── sand.jpg
│       └── venice_sunset_1k.hdr
├── scripts
│   ├── checkAssetBudget.js
│   ├── checkPositions.js
│   ├── checkScales.js
│   ├── convertNewCharacters.js
│   ├── downloadAssets.js
│   ├── generateAudioAssets.js
│   ├── generateCharacterAssets.js
│   ├── optimizeAssets.js
│   ├── optimizeCharacters.js
│   └── splitBuildings.js
├── src
│   ├── App.vue
│   ├── data
│   │   └── GameContent.js
│   ├── game
│   │   ├── config
│   │   │   └── GameConfig.js
│   │   ├── core
│   │   │   ├── CameraRig.js
│   │   │   ├── Engine.js
│   │   │   ├── QualityManager.js
│   │   │   └── ViewportManager.js
│   │   ├── entities
│   │   │   ├── CharacterLoader.js
│   │   │   ├── Obstacles.js
│   │   │   └── Player.js
│   │   ├── systems
│   │   │   ├── AudioManager.js
│   │   │   ├── CollisionSystem.js
│   │   │   ├── EffectsSystem.js
│   │   │   ├── InputManager.js
│   │   │   └── ScoreSystem.js
│   │   └── world
│   │       ├── FootpathPropSystem.js
│   │       ├── PatternLibrary.js
│   │       ├── SceneryInstancer.js
│   │       ├── SpawnDirector.js
│   │       ├── TrackBuilder.js
│   │       └── WorldStreamer.js
│   ├── main.js
│   ├── services
│   │   └── SheetService.js
│   └── ui
│       ├── BossBeat.vue
│       ├── CharacterSelect.vue
│       ├── GameHUD.vue
│       ├── GameOver.vue
│       ├── HowToPlay.vue
│       ├── IdlePrompt.vue
│       ├── Landing.vue
│       ├── LevelComplete.vue
│       ├── LevelIntro.vue
│       ├── OfferReveal.vue
│       ├── PauseMenu.vue
│       ├── Redemption.vue
│       ├── RegistrationForm.vue
│       ├── StoryBeat.vue
│       ├── style.css
│       └── Victory.vue
└── vite.config.js
```
