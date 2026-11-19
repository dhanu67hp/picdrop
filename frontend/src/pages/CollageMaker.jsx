
import { useState } from "react";

const API = "https://picdrop-sobo.onrender.com";
const MAX_PHOTOS = 8;

function drawCover(ctx, image, x, y, width, height) {
  const imageRatio = image.width / image.height;
  const boxRatio = width / height;

  let sourceX = 0;
  let sourceY = 0;
  let sourceWidth = image.width;
  let sourceHeight = image.height;

  if (imageRatio > boxRatio) {
    sourceWidth = image.height * boxRatio;
    sourceX = (image.width - sourceWidth) / 2;
  } else {
    sourceHeight = image.width / boxRatio;
    sourceY = (image.height - sourceHeight) / 2;
  }

  ctx.drawImage(
    image,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    x,
    y,
    width,
    height
  );
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";

    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not load an image."));

    image.src = src;
  });
}

function CollageMaker({ mediaList = [], roomCode }) {
  const imageList = mediaList.filter(
    (media) => media.type === "image"
  );

  const [selectedPhotos, setSelectedPhotos] = useState([]);
  const [layout, setLayout] = useState("grid");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [collageUrl, setCollageUrl] = useState("");

  const togglePhoto = (photo) => {
    setMessage("");

    setSelectedPhotos((prev) => {
      const exists = prev.some((item) => item.id === photo.id);

      if (exists) {
        return prev.filter((item) => item.id !== photo.id);
      }

      if (prev.length >= MAX_PHOTOS) {
        setMessage("You can select up to 8 photos.");
        return prev;
      }

      return [...prev, photo];
    });
  };

  const createCollage = async () => {
    if (selectedPhotos.length < 2) {
      setMessage("Please select at least 2 photos.");
      return null;
    }

    setBusy(true);
    setMessage("");

    try {
      const images = await Promise.all(
        selectedPhotos.map((photo) => loadImage(photo.src))
      );

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        throw new Error("Canvas is not supported in this browser.");
      }

      const gap = 12;
      const background = "#111827";

      let columns;
      let rows;

      if (layout === "strip") {
        columns = images.length;
        rows = 1;
        canvas.width = 1800;
        canvas.height = 650;
      } else if (layout === "portrait") {
        columns = 2;
        rows = Math.ceil(images.length / 2);
        canvas.width = 1080;
        canvas.height = 1920;
      } else {
        columns = 2;
        rows = Math.ceil(images.length / 2);
        canvas.width = 1200;
        canvas.height = 1200;
      }

      ctx.fillStyle = background;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const cellWidth =
        (canvas.width - gap * (columns + 1)) / columns;

      const cellHeight =
        (canvas.height - gap * (rows + 1)) / rows;

      images.forEach((image, index) => {
        const column = index % columns;
        const row = Math.floor(index / columns);

        const x = gap + column * (cellWidth + gap);
        const y = gap + row * (cellHeight + gap);

        drawCover(ctx, image, x, y, cellWidth, cellHeight);
      });

      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob((result) => {
          if (result) resolve(result);
          else reject(new Error("Could not generate collage."));
        }, "image/png");
      });

      const url = URL.createObjectURL(blob);

      setCollageUrl((previous) => {
        if (previous) URL.revokeObjectURL(previous);
        return url;
      });

      return blob;
    } catch (err) {
      console.error("Collage error:", err);
      setMessage(err.message || "Could not create collage.");
      return null;
    } finally {
      setBusy(false);
    }
  };

  const downloadCollage = async () => {
    const blob = await createCollage();

    if (!blob) return;

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "picconnect-collage.png";
    link.click();

    URL.revokeObjectURL(url);
    setMessage("Collage downloaded successfully!");
  };

  const saveToGallery = async () => {
    if (!roomCode) {
      setMessage("Room code is missing.");
      return;
    }

    const blob = await createCollage();

    if (!blob) return;

    setBusy(true);

    try {
      const formData = new FormData();

      formData.append(
        "file",
        blob,
        "picconnect-collage.png"
      );

      const response = await fetch(
        `${API}/api/rooms/${roomCode}/upload`,
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Could not save collage.");
      }

      setMessage("Collage saved to Shared Gallery!");
    } catch (err) {
      setMessage(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="collage-maker">
      <div className="collage-heading">
        <div>
          <span className="collage-eyebrow">PICCONNECT CREATIVE STUDIO</span>
          <h2>AI Collage Maker</h2>
          <p>Turn your shared memories into a beautiful collage.</p>
        </div>

        <span className="collage-count">
          {selectedPhotos.length}/{MAX_PHOTOS} selected
        </span>
      </div>

      <div className="collage-layout-options">
        <button
          className={layout === "grid" ? "active" : ""}
          onClick={() => setLayout("grid")}
          type="button"
        >
          Grid
        </button>

        <button
          className={layout === "portrait" ? "active" : ""}
          onClick={() => setLayout("portrait")}
          type="button"
        >
          Portrait
        </button>

        <button
          className={layout === "strip" ? "active" : ""}
          onClick={() => setLayout("strip")}
          type="button"
        >
          Film Strip
        </button>
      </div>

      <div className="collage-workspace">
        <div className="collage-photo-picker">
          <h3>Choose your photos</h3>
          <p>Select at least 2 photos from your shared gallery.</p>

          <div className="collage-photo-grid">
            {imageList.map((photo) => {
              const selected = selectedPhotos.some(
                (item) => item.id === photo.id
              );

              return (
                <button
                  type="button"
                  key={photo.id}
                  className={`collage-photo-option ${
                    selected ? "selected" : ""
                  }`}
                  onClick={() => togglePhoto(photo)}
                >
                  <img src={photo.src} alt={photo.name} />

                  <span>
                    {selected ? "✓" : "+"}
                  </span>
                </button>
              );
            })}
          </div>

          {imageList.length === 0 && (
            <div className="collage-empty">
              <span>🖼️</span>
              <h3>No photos available</h3>
              <p>Upload some images to your Gallery first.</p>
            </div>
          )}
        </div>

        <div className="collage-preview-panel">
          <h3>Collage Preview</h3>

          {collageUrl ? (
            <img
              className="collage-generated-preview"
              src={collageUrl}
              alt="Generated collage"
            />
          ) : (
            <div className={`collage-preview ${layout}`}>
              {selectedPhotos.map((photo) => (
                <img
                  key={photo.id}
                  src={photo.src}
                  alt={photo.name}
                />
              ))}

              {selectedPhotos.length === 0 && (
                <div className="collage-preview-placeholder">
                  Your collage preview will appear here.
                </div>
              )}
            </div>
          )}

          <div className="collage-actions">
            <button
              type="button"
              onClick={downloadCollage}
              disabled={busy || selectedPhotos.length < 2}
            >
              {busy ? "Working..." : "↓ Download Collage"}
            </button>

            <button
              type="button"
              onClick={saveToGallery}
              disabled={busy || selectedPhotos.length < 2}
            >
              Save to Gallery
            </button>
          </div>

          {message && (
            <p className="collage-message">{message}</p>
          )}
        </div>
      </div>
    </section>
  );
}

export default CollageMaker;
