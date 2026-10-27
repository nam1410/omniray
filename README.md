# OmniRay: Monocular 3D Reconstruction with Composite Ray Fields

Project page: **https://nam1410.github.io/omniray/**

Namitha Guruprasad<sup>1</sup>, Abhay Yadav<sup>1</sup>, Cheng Peng<sup>2</sup>,
Rama Chellappa<sup>1</sup>, Anand Bhattad<sup>1</sup>

<sup>1</sup>Johns Hopkins University &nbsp;&nbsp; <sup>2</sup>University of Virginia

---

OmniRay reconstructs 3D geometry from a single image taken by an arbitrary central
camera — pinhole, fisheye, or panoramic — with no intrinsics, distortion parameters, or
camera-type label. The ray field is composed from a monotone radial base, a
spherical-harmonic residual, and a free-form residual, each applied as a rotation on the
sphere, and a shared distance module scales the rays into a point cloud.

Code and models are planned to be open-sourced upon publication.

## This repository

Source for the project page only.

```
index.html             the page (self-contained; CSS and JS inline)
static/images/         figures, taken from the paper
demo/viewer.js         live point-cloud viewers embedded in index.html (three.js r164.1,
                       pinned, via jsDelivr); demo/examples.js lists the examples and
                       demo/embed.css styles the widget. demo/index.html only redirects.
demo/assets/benchmark/ one example per camera: input.jpg, thumb.jpg + da3 / unik3d / omniray / gt .ply
demo/assets/zeroshot/  in-the-wild examples: input.jpg, thumb.jpg + pred.ply
```

Point clouds are subsampled for the web and keep their original camera-frame
coordinates; the viewer recentres and rescales them at render time only.

TODO: the predicted ray fields (`*_rays.ply`, unit vectors on the sphere) exist for every
example but are not uploaded yet. Adding them would roughly double the asset size (~28 MB
today); a "show rays" toggle in the viewer is the planned way to expose them.

Served by GitHub Pages from `main` at `/`.
