import {invoke} from "@tauri-apps/api/core";
import {imageDimensions} from "./imageDimensions";
export interface StoredBackground {id:string;name:string;thumbnailDataUrl:string}
export const listWorkspaceBackgrounds = () => invoke<StoredBackground[]>("list_workspace_backgrounds");
export const readWorkspaceBackground = (id:string) => invoke<string>("read_workspace_background",{id});
export const removeWorkspaceBackground = (id:string) => invoke<void>("remove_workspace_background",{id});

/** The browser decodes a user-selected file. Only bounded, re-encoded PNGs cross IPC. */
export async function importWorkspaceBackground(file:File):Promise<StoredBackground> {
  if (!["image/png","image/jpeg","image/webp"].includes(file.type) || file.size > 20*1024*1024) throw new Error("unsupported-image");
  const dimensions=imageDimensions(new Uint8Array(await file.arrayBuffer()));
  if(!dimensions.width||!dimensions.height||dimensions.width*dimensions.height>32_000_000)throw new Error("image-too-large");
  const bitmap = await createImageBitmap(file);
  try {
    if (!bitmap.width || !bitmap.height || bitmap.width*bitmap.height > 32_000_000) throw new Error("image-too-large");
    const encode = (maximum:number) => {
      const scale = Math.min(1,maximum/Math.max(bitmap.width,bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width=Math.max(1,Math.round(bitmap.width*scale)); canvas.height=Math.max(1,Math.round(bitmap.height*scale));
      const context=canvas.getContext("2d");
      if (!context) throw new Error("image-unavailable");
      context.drawImage(bitmap,0,0,canvas.width,canvas.height);
      return canvas.toDataURL("image/png").split(",")[1];
    };
    return await invoke<StoredBackground>("import_workspace_background",{name:file.name,png:encode(2560),thumbnail:encode(240)});
  } finally {bitmap.close();}
}
