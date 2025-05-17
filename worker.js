import {
	initializeImageMagick,
	ImageMagick,
	MagickFormat,
	MagickReadSettings,
	MagickGeometry,
	Gravity,
} from "./magick.js";

const getBytes = path => fetch(path).then(r => r.arrayBuffer()).then(b => new Uint8Array(b));
const isFirefox = navigator.userAgent.toLowerCase().includes("firefox");
const wasm = await getBytes("magick.wasm");
await initializeImageMagick(wasm);
console.log("ImageMagick initialized");

self.onmessage = async event => {
	const { path, sizes, quality } = event.data;

	try {
		const gif = await getBytes(path);

		if (
			gif[0] !== 0x47 || gif[1] !== 0x49 || gif[2] !== 0x46 ||
			gif[3] !== 0x38 || gif[4] !== 0x39 || gif[5] !== 0x61
		) {
			throw new Error("Invalid GIF 89a header.");
		}

		const settings = new MagickReadSettings({ quality });

		ImageMagick.readCollection(gif, settings, async images => {
			try {
				if (images.length === 1) throw new Error("1 frame GIF");

				images.coalesce();

				for (const size of sizes) {
					for (const format of [MagickFormat.Gif, MagickFormat.WebP]) {
						for (const optimize of [true, false]) {
							const base64Url = await resizeAndConvert(images, size, quality, format, optimize);
							self.postMessage({
								success: true,
								base64Url,
								path,
								size,
								format: format.toLowerCase(),
								optimized: optimize,
							});
						}
					}
				}
			}
			catch (error) {
				self.postMessage({ success: false, error: error.message });
			}
		});
	}
	catch (error) {
		self.postMessage({ success: false, error: error.message });
	}
};

function resizeAndConvert(images, size, quality, format, shouldOptimizeTransparency) {
	return new Promise(resolve => {
		images.clone(clones => {
			clones.forEach(image => {
				image.crop(new MagickGeometry("1:1"), Gravity.Center);
				image.resetPage();
				image.resize(size, size);
				image.quality = quality;

				if (format === MagickFormat.WebP) {
					image.settings.setDefine(MagickFormat.WebP, "lossless", true);
				}
			});

			clones.optimizePlus();
			if (shouldOptimizeTransparency) {
				clones.optimizeTransparency();
			}

			writeImages(clones, format, resolve);
		});
	});
}

function writeImages(images, format, resolve) {
	images.write(format, data => {
		// https://crbug.com/42204568
		if (isFirefox) {
			resolve(`data:image/${ format.toLowerCase() };base64,${ data.toBase64() }`);
		}
		else {
			const blob = new Blob([data], { format: `image/${ format.toLowerCase() }` });
			const reader = new FileReader();
			reader.onload = () => resolve(reader.result);
			reader.readAsDataURL(blob);
		}
	});
}
