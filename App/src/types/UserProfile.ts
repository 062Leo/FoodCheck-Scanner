export interface UserProfile {
  username: string;
  joinDate: string | null;
  productsAdded: number | null;
  productsEdited: number | null;
  photosUploaded: number | null;
  productsScanned: number | null;
  profileUrl: string;
}
