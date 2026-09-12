export type ExportMetadata = {
  attributionUrl: string;
  qrPayload: string;
};

export function createExportMetadata(shareUrl: string): ExportMetadata {
  return {
    attributionUrl: "https://beadloom.app",
    qrPayload: shareUrl
  };
}
