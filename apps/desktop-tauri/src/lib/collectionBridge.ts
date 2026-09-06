import {invoke} from "@tauri-apps/api/core";
import type {Collection,CollectionView,ItemFields} from "../surfaces/collections/collectionModel";
export interface CollectionLayoutSnapshot {
  version:1;revision:number;view:CollectionView;scale:number;
  groups:(Collection&{x:number;y:number})[];fields:Record<string,ItemFields>;
}
export const getCollectionLayout=()=>invoke<CollectionLayoutSnapshot>("get_collection_layout");
export const setCollectionLayout=(layout:CollectionLayoutSnapshot)=>invoke<CollectionLayoutSnapshot>("set_collection_layout",{layout});
