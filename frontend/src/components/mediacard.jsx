function MediaCard({ type, src }) {
  return (
    <div className="media-card">

      {type === "image" ? (
        <img src={src} alt="Shared media" />
      ) : (
        <video src={src} controls />
      )}

    </div>
  );
}

export default MediaCard;