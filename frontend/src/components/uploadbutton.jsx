function UploadButton() {
  return (
    <div className="upload-section">
      <input type="file" accept="image/*,video/*" />

      <button>
        Upload Media
      </button>
    </div>
  );
}

export default UploadButton;