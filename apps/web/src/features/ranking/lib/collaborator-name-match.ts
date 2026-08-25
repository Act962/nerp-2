export interface CollaboratorNameEntry {
  name: string;
  photoUrl: string | null;
}

export function normalizeCollaboratorName(name: string): string {
  return name.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export function buildCollaboratorPhotoMap(
  collaborators: CollaboratorNameEntry[],
): Map<string, string | null> {
  return new Map(
    collaborators.map((collaborator) => [
      normalizeCollaboratorName(collaborator.name),
      collaborator.photoUrl,
    ]),
  );
}
