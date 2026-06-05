export type TmuxPane = {
  id: string;
  sessionName: string;
  paneIndex: number;
  command: string;
};

export type TmuxRunner = {
  run: (argumentsList: string[]) => string;
};
