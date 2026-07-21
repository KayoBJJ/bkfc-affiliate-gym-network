export type UploadField = "logoUpload" | "gymPhotos" | "fighterListUpload";

export type UploadDescriptor = {
  field: UploadField;
  name: string;
  size: number;
  type: string;
};

export type IssuedUpload = UploadDescriptor & {
  path: string;
  contentType: string;
  uploaded?: boolean;
};

export type UploadSessionResponse = {
  success: true;
  sessionId: string;
  applicationReference: string;
  storageEndpoint: string;
  bucket: string;
  uploads: IssuedUpload[];
};
