/** resize прототипа: уменьшить фото до max px по длинной стороне. url = data URL (миниатюра), иначе base64 для ИИ. */
export function resizeImage(file: Blob, max: number, q: number): Promise<string> {
  return new Promise((ok, fail) => {
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * s);
      c.height = Math.round(img.height * s);
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      ok(c.toDataURL('image/jpeg', q));
    };
    img.onerror = () => fail(new Error('image'));
    img.src = URL.createObjectURL(file);
  });
}
