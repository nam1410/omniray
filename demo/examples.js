/* Example lists shared by demo/index.html and the landing page. dir is relative to demo/. */

/* Each benchmark example directory holds input.jpg plus da3.ply, unik3d.ply,
   omniray.ply and gt.ply, all sampled at the same pixels. Optional: size (one
   default point size for all four panels) or sizes: { da3, unik3d, omniray, gt }. */
export const BENCHMARK = [
  { key: 'panorama', dir: 'assets/benchmark/panorama', tab: 'Panorama',
    name: 'Equirectangular panorama', source: 'PanoCity, never trained on' },
  { key: 'fisheye', dir: 'assets/benchmark/fisheye', tab: 'Fisheye',
    name: 'Fisheye', source: 'PanoCity, never trained on' },
  { key: 'gopro', dir: 'assets/benchmark/gopro', tab: 'GoPro', heldout: true,
    name: 'GoPro fisheye', source: 'PanoCity; this camera configuration was withheld from training' },
  { key: 'catadioptric', dir: 'assets/benchmark/catadioptric', tab: 'Catadioptric', heldout: true,
    name: 'Catadioptric', source: 'PanoCity; this camera configuration was withheld from training',
    note: 'A Nayar catadioptric camera images a 40°–155° annulus about its axis ' +
          'through a paraboloid mirror. The outer ring of the input is the ground around the ' +
          'camera; the sky sits at the centre.' },
  { key: 'pinhole', dir: 'assets/benchmark/pinhole', tab: 'Pinhole',
    name: 'Pinhole', source: 'CO3Dv2, never trained on',
    note: 'CO3Dv2 ground truth is object-masked, so all four clouds cover the object only.' }
];

/* size: default point size for the cloud (world units, after normalisation).
   Left out, the viewer picks one from the point count (viewer.js, autoPointSize).
   The two 360° panoramas are viewed from inside the sphere, so the auto value
   for their 131k points reads as thin; they get a slightly larger default. */
export const ZEROSHOT = [
  { key: 'au_march', dir: 'assets/zeroshot/au_march', tab: 'Panorama, street',
    name: 'Street panorama', source: 'equirectangular photograph from the internet', size: 0.008 },
  { key: 'biblioteca', dir: 'assets/zeroshot/biblioteca', tab: 'Panorama, indoor',
    name: 'Indoor panorama', source: 'equirectangular photograph from the internet', size: 0.008 },
  { key: 'casa_de_murillo', dir: 'assets/zeroshot/casa_de_murillo', tab: 'Circular fisheye',
    name: 'Circular fisheye', source: 'photograph from the internet' },
  { key: 'fisheye_bedroom', dir: 'assets/zeroshot/fisheye_bedroom', tab: 'Fisheye, bedroom',
    name: 'Fisheye bedroom', source: 'photograph from the internet' },
  { key: 'gopro_patio', dir: 'assets/zeroshot/gopro_patio', tab: 'GoPro, patio',
    name: 'GoPro patio', source: 'photograph from the internet' },
  { key: 'pinhole_table', dir: 'assets/zeroshot/pinhole_table', tab: 'Pinhole, table',
    name: 'Pinhole table', source: 'phone photograph' }
];

/* Teaser (Fig. 1): one OmniRay reconstruction per camera family, paper order.
   Each directory holds input.jpg and omniray.ply. */
export const TEASER = [
  { key: 'pinhole', dir: 'assets/teaser/pinhole', tab: 'Pinhole', source: 'CO3Dv2' },
  { key: 'gopro', dir: 'assets/teaser/gopro', tab: 'GoPro', source: 'PanoCity', heldout: true },
  { key: 'fisheye', dir: 'assets/teaser/fisheye', tab: 'Fisheye', source: '2D3DS' },
  { key: 'catadioptric', dir: 'assets/teaser/catadioptric', tab: 'Catadioptric', source: '2D3DS', heldout: true },
  { key: 'panorama', dir: 'assets/teaser/panorama', tab: 'Panorama', source: '360Loc' }
];
