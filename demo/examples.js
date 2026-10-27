/* Example lists shared by demo/index.html and the landing page. dir is relative to demo/. */

/* Each benchmark example directory holds input.jpg plus da3.ply, unik3d.ply,
   omniray.ply and gt.ply, all sampled at the same pixels. */
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

export const ZEROSHOT = [
  { key: 'au_march', dir: 'assets/zeroshot/au_march', tab: 'Panorama, street',
    name: 'Street panorama', source: 'equirectangular photograph from the internet' },
  { key: 'biblioteca', dir: 'assets/zeroshot/biblioteca', tab: 'Panorama, indoor',
    name: 'Indoor panorama', source: 'equirectangular photograph from the internet' },
  { key: 'casa_de_murillo', dir: 'assets/zeroshot/casa_de_murillo', tab: 'Circular fisheye',
    name: 'Circular fisheye', source: 'photograph from the internet' },
  { key: 'fisheye_bedroom', dir: 'assets/zeroshot/fisheye_bedroom', tab: 'Fisheye, bedroom',
    name: 'Fisheye bedroom', source: 'photograph from the internet' },
  { key: 'gopro_patio', dir: 'assets/zeroshot/gopro_patio', tab: 'GoPro, patio',
    name: 'GoPro patio', source: 'photograph from the internet' },
  { key: 'pinhole_table', dir: 'assets/zeroshot/pinhole_table', tab: 'Pinhole, table',
    name: 'Pinhole table', source: 'phone photograph' }
];
