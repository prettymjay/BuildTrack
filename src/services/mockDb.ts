export type UserRecord = {
  username: string;
  password: string;
  name?: string;
};

// Temporary in-memory user database. Replace with a real DB later.
export const users: UserRecord[] = [
  { username: "admin", password: "1234", name: "Administrator" },
];

export function findUser(username: string): UserRecord | undefined {
  return users.find((u) => u.username === username);
}
