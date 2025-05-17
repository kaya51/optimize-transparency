const worker = new Worker("worker.js", { type: "module" });
let counter = 0;

document.body.addEventListener("click", () => {
	console.log("clicked");

	const path = `gifs/${ ++counter }.gif`;
	const sizes = [50];
	const quality = 50;

	for (const size of sizes) {
		const row = document.createElement("div");
		row.className = "row";
		row.dataset.path = path;
		row.dataset.size = size;

		for (const format of ["gif", "webp"]) {
			for (const optimize of [true, false]) {
				const cell = document.createElement("div");
				cell.className = "cell";
				cell.dataset.format = format;
				cell.dataset.optimize = optimize;

				const caption = document.createElement("span");
				caption.textContent = `${ format.toUpperCase() } - ${ optimize ? "Optimized" : "Unoptimized" }`;

				cell.append(caption);
				row.append(cell);
			}
		}

		document.body.append(row);
		worker.postMessage({ path, sizes: [size], quality, });
	}
});

worker.onmessage = event => {
	const { success, base64Url, format, size, optimized, path, error } = event.data;

	if (!success) {
		console.error(`Error processing image in Web Worker: ${ error }`);
		return;
	}

	const img = document.createElement("img");
	img.src = base64Url;

	const cell = document.querySelector(`.row[data-path="${ path }"][data-size="${ size }"] > .cell[data-format="${ format }"][data-optimize="${ optimized }"]`);
	cell.append(img);
};
