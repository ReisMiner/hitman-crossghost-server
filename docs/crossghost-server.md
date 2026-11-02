# CrossGhost server: one container

The [CrossGhost server](https://git.ramon.cc/ramon/crossghost-server) runs the game backend, room-code API and authenticated UDP relay in
one Node process. Everything needed to deploy is inside this repository.

## Deploy

From the fork's root:

```sh
docker compose up -d --build
```

The defaults are ready for **https://hitmanghost.ramon.cc**:

- **TCP 47047:** the single HTTP upstream for your existing HTTPS proxy. Forward
  the whole domain here, preserving request paths.
- **UDP 30002:** game relay. Publish/allow this port directly on the VPS.

The domain's IPv4 address must reach this VPS for UDP as well as HTTP. Players
connect through room codes; they never enter ports or forward their own routers.

Check the deployment:

```sh
docker compose ps
docker compose logs --tail=100
curl --fail https://hitmanghost.ramon.cc/healthz
curl --fail https://hitmanghost.ramon.cc/config/pc-prod/8_2_0
```

Health returns `ok`. All game config/resource URLs and room responses use
`https://hitmanghost.ramon.cc`, independent of incoming Host/protocol headers.

### Optional settings

Defaults require no `.env` file. Compose accepts these overrides if needed:

| Variable | Default | Purpose |
| --- | --- | --- |
| `PUBLIC_ORIGIN` | `https://hitmanghost.ramon.cc` | Shared public origin, without a path |
| `HTTP_PORT` | `47047` | Published HTTP upstream port |
| `RELAY_PORT` | `30002` | Published and advertised UDP relay port |
| `TRUST_PROXY` | `single` | One trusted proxy hop for per-client rate limits; `loopback` and `none` also work |

Changing the public origin also requires rebuilding the player DLL with the same
origin. Keep the container on Node 22 for the dependency set inherited from LocalGhost.

### Profiles and updates

Profiles persist in the named volume `localghost_userdata` (its name is kept
from before the CrossGhost rename, so existing profiles stay). Fresh volumes start
with the reference templates. Local player profiles and identity bindings are
excluded from the image; import existing userdata separately when migrating.

Run `docker compose up -d --build` to deploy updated sources. Active room codes
are in memory and end when the process restarts. `docker compose down` retains
profiles; adding `-v` deletes the volume.

For a consistent backup:

```sh
docker compose stop crossghost
docker compose run --rm --no-deps -T crossghost tar -C /app/userdata -czf - . > userdata-backup.tar.gz
docker compose start crossghost
```

### Upgrading a deployment from the `localghost` compose project

The compose project and service are now called `crossghost`. Stop the old
container once (it holds the ports), then start the new one; profiles carry
over through the shared `localghost_userdata` volume:

```sh
docker compose -p localghost down
docker compose up -d --build
```

## Player flow

With `CrossGhost.dll` and the CrossGhost Assets mod (`ramoncc.CrossGhostAssets`) installed, either storefront
selects a map/lobby and presses **Host**. They share the five-digit room code.
The other player enters that code and presses **Join**. The DLL configures the
game backend automatically. Both Epic-host/Steam-guest and Steam-host/Epic-guest
are supported.

### Hawke's Bay

The H3 menu lists every Ghost map in the game's destination order (see
"Creator maps" below); Miami, Santa Fortuna, Hawke's Bay, Haven Island and Paris
are in the Random Map pool. Hawke's Bay uses the Ghost Mode mod's daytime **Anubis** mission, not
the Nightcall story contract. Both PCs need Ghost Mode assets **2.1.0 or newer**
(2.3.0 recommended), which include the Hawke's Bay entities.

After updating the server sources, run `docker compose up -d --build` and restart
both games to refresh the map menu. Install the updated universal DLL on both
PCs; the Epic guest needs its new Hawke's Bay preset-to-contract fallback.
There are no additional containers, ports or player settings.

Definitions:

- `Server/contractdata/8fcf8f5d-0fe9-47d7-bff3-d747d0cd1e89.json`: the Anubis
  scene, Ghost Mode bricks, objective and scoring. It uses the same objective
  state machine as the existing Ghost Mode contracts. The mission ID and asset
  list were checked against Peacock's `contractdata/GHOST/ANUBIS.json` and the
  HITMAPS Ghost Mode mod's `manifest.json`.
- `Server/menudata/h3/menudata/multiplayerpresets.json`: the dedicated Hawke's
  Bay invite preset (ID equal to its contract ID) and the all-map pools.
- The earlier experimental `GhostLobbyService` map list is not used by the DLL;
  the native game gets its maps through `/multiplayerpresets`.

Automated tests cover menu data, required resources and match registration in
both store directions. Two-PC gameplay still needs a manual test.

### Haven Island — one merged SMF mod

Haven requires the workspace's merged `HITMAPS.GhostModeEnabler` **2.4.0**
edition on both PCs. It contains Adam's `Ghost-Mode-Haven` gameplay assets;
do not install/enable `Adam.GhostHaven` as a second mod. Replace the existing
Ghost Mode folder in SMF's Mods directory and deploy on both PCs. Players still
need their own installed Haven Island map content.

Deploy the server with `docker compose up -d --build`, install the updated
universal DLL on both PCs, and restart both games. The Haven Island invite tile
follows Hawke's Bay; Haven is also included in the Random Map pool.

- Contract and dedicated preset: `5e895adf-9879-44d9-b43f-13bb24e897bc`.
- Scene: `assembly:/_pro/scenes/missions/opulent/mission_stingray/scene_stingray_basic.entity`.
- Location: `LOCATION_OPULENT_STINGRAY`; entitlement: `LOCATION_OPULENT`.
- Bricks: Haven's `versus_targets_opulent_stingray`,
  `versus_items_opulent_stingray`, `versus_entrance_opulent_stingray`, plus
  shared `ui_versus` and `vs_race_multiplayer`.
- The merged targets asset includes the
  `fDynamicScaleCloseupDistance: 0.0` field required by the current game; the
  original standalone Haven asset fails SMF deployment without it.
- Objective and five-point scoring follow the existing versus contracts; the
  story contract is not reused as a playable versus contract.

The original Haven assets were advertised for Steam only. Offline tests cover
the merged package and both server-side host directions, but manual SMF
deployment and two-PC gameplay are still required to validate Steam/Epic Haven.

### Paris

Paris is included in the same **2.5.0** mod package, so there is still only one
SMF mod to install. Deploy the updated package and the updated server, then
install the updated universal DLL on both PCs and restart both games. Paris
appears in **Invite Player** after Haven and is part of Random Map.

- Contract and dedicated preset: `59d1caab-2056-4f4b-a921-9958ef0a88eb`.
- Scene: `assembly:/_pro/scenes/missions/paris/_scene_paris.entity`.
- Location: `LOCATION_PARIS`; entitlement: `LOCATION_PARIS`.
- Bricks: `versus_targets_paris`, `versus_items_paris`,
  `versus_entrance_paris`, plus shared `ui_versus` and `vs_race_multiplayer`.
- The asset mod adds 24 player starts in 12 public-ground-floor pairs, 24 mixed
  item crates (eight each of Ghost equipment, tools/poisons and weapons) and
  42 new target NPCs with three-stop local patrol loops. Their
  coordinates are checked against native access volumes, navigation and exported
  map geometry; runtime collision and two-PC gameplay still need manual testing.
  The story targets and native scene are left intact.
- The target picker is the same H3 versus composite used by Hawke's Bay. Its
  target list, roles and drama situations are authored in the Paris targets
  brick; the existing `vs_race_multiplayer` rules provide selection/scoring.

Automated tests validate the three brick documents, every local entity
reference, resource registrations, server menu/resource responses and both
host directions. Actual SMF deployment, spawn points, target reachability and
cross-store gameplay still need a manual two-PC test.

### Creator maps (all other main destinations)

Every main destination except Miami, Santa Fortuna and the Carpathian
Mountains train has an **Invite Player** preset. Presets are listed in the
game's destination order (`allunlockables.json` location `Order`): Random Map,
Quick Match, ICA Facility, Paris, Sapienza, Marrakesh, Bangkok, Colorado,
Hokkaido, Hawke's Bay, Miami, Santa Fortuna, Mumbai, Whittleton Creek, Ambrose
Island, Isle of Sgàil, New York, Haven Island, Dubai, Dartmoor, Berlin,
Chongqing, Mendoza, then the featured match.

The 16 new maps have no Ghost content until the GhostModeCreator plugin creates
it: in the Creator's project panel choose the merged mod folder, pick the map
under **Ghost Mode maps** and press **Create missing Ghost files** (or open
the map in game). That writes the map's empty `versus_{items,entrance,targets}`
bricks (one start pair at the mission's default spawn, an empty target list),
registers them in the mod and adds the lobby names. Deploy with SMF on both
PCs, then load the map's preset and author it like Paris. **Do not load a new
map's preset before its bricks are deployed**; the contract requires them.
The new maps are not in Random Map / Quick Match yet; add a map's contract ID to
those pools once it has targets and crates.

| Map | Contract / preset ID | Scene (`assembly:/_pro/scenes/missions/…`) | Location | Entitlement |
| --- | --- | --- | --- | --- |
| ICA Facility | `566ec2b6-27d4-4ade-b38e-7a63877724aa` | `thefacility/_scene_mission_polarbear_module_005.entity` | `LOCATION_ICA_FACILITY` | none |
| Sapienza | `457f18d3-0075-4a3c-aab0-bded15748138` | `coastaltown/_scene_octopus.entity` | `LOCATION_COASTALTOWN` | `LOCATION_COASTALTOWN` |
| Marrakesh | `bc3b7358-7226-4061-860f-5896e4b2906c` | `marrakesh/_scene_mission_spider.entity` | `LOCATION_MARRAKECH` | `LOCATION_MARRAKECH` |
| Bangkok | `a13c32cc-d337-4b1e-a996-412469c01695` | `bangkok/_scene_mission_tiger.entity` | `LOCATION_BANGKOK` | `LOCATION_BANGKOK` |
| Colorado | `581504c1-6336-4f9c-b53f-16a6436e199a` | `colorado_2/_scene_mission_bull.entity` | `LOCATION_COLORADO` | `LOCATION_COLORADO` |
| Hokkaido | `006117fc-4c7b-4053-9a43-410a9fa7f7f1` | `hokkaido/_scene_mission_snowcrane.entity` | `LOCATION_HOKKAIDO` | `LOCATION_HOKKAIDO` |
| Mumbai | `611afe7f-e150-4098-9858-db16ec2a125f` | `mumbai/scene_mongoose.entity` | `LOCATION_MUMBAI` | `LOCATION_MUMBAI` |
| Whittleton Creek | `38d4803c-2622-47ba-8e57-a3d3fb10e025` | `skunk/scene_skunk.entity` | `LOCATION_NORTHAMERICA` | `LOCATION_NORTHAMERICA` |
| Ambrose Island | `a608f1e4-4e4e-4ac0-a57d-b14b4bf69e7f` | `rocky/scene_dugong.entity` | `LOCATION_ROCKY_DUGONG` | `LOCATION_ROCKY` |
| Isle of Sgàil | `c4a70bbe-7f67-43ea-9e9d-b3184a61b8a5` | `theark/scene_magpie.entity` | `LOCATION_NORTHSEA` | `LOCATION_NORTHSEA` |
| New York | `5352638d-41e4-4761-845b-5a963c172af2` | `greedy/mission_raccoon/scene_raccoon_basic.entity` | `LOCATION_GREEDY_RACCOON` | `LOCATION_GREEDY` |
| Dubai | `30eaeec0-11cb-4178-8bc8-40da3568fafc` | `golden/mission_gecko/scene_gecko_basic.entity` | `LOCATION_GOLDEN_GECKO` | `LOCATION_GOLDEN` |
| Dartmoor | `9b7d0445-4e4a-4534-b788-8365ac616976` | `ancestral/scene_bulldog.entity` | `LOCATION_ANCESTRAL_BULLDOG` | `LOCATION_ANCESTRAL` |
| Berlin | `5f0cc0b6-9dfa-4ad9-9f27-01d68e083516` | `edgy/mission_fox/scene_fox_basic.entity` | `LOCATION_EDGY_FOX` | `LOCATION_EDGY` |
| Chongqing | `cddcc656-3a85-4d60-b8b5-1e0dd55fcfb2` | `wet/scene_rat_basic.entity` | `LOCATION_WET_RAT` | `LOCATION_WET` |
| Mendoza | `336c4701-f6c8-4161-aebb-3de84c6eb696` | `elegant/scene_llama.entity` | `LOCATION_ELEGANT_LLAMA` | `LOCATION_ELEGANT` |

Each contract copies Paris's objective, scoring and shared bricks with its own
objective ID and `PublicId`. Scenes are the main missions as registered in the
game's package definition; locations and entitlements come from
`allunlockables.json`. Lobby titles use `UI_LOCATION_<code>_CITY` keys whose
English text the Creator writes into the mod manifest. None of the new maps has
been loaded in a Ghost match yet.

## Implementation and tests

- `Server/serb.js` mounts `/healthz`, `/v1/config` and `/v1/rooms/*` before the
  game-token middleware, on the same HTTP listener as all game endpoints.
- `Server/components/ghostRooms/` contains the binary room protocol and UDP relay.
  It preserves native RakNet/app payloads and uses per-member HMAC-SHA256 tokens,
  replay rejection, NAT rebinding, leases, two-player capacity and bounded traffic.
- Existing game-facing Ghost Mode endpoints and the earlier experimental
  `GhostLobbyService` remain in their existing components. The DLL uses `/v1/rooms/*`.
- The HTTP listener starts only after the UDP socket binds successfully. SIGTERM
  closes the shared listener and relay together.

Run the backend/room integration tests with Node 22:

```sh
cd Server
npm ci --omit=dev --ignore-scripts
npm test
```

For a direct local development run, set `PUBLIC_ORIGIN=http://127.0.0.1:47047`,
`PORT=47047`, then run `npm start` from `Server/`. The native development DLL must
use that same origin.

Current validation: Compose configuration and all four backend/room integration
tests passed under Node 22. Actual container startup remains untested locally
because the Docker daemon is stopped; public two-network gameplay is pending.
