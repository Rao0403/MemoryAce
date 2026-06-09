export type FaceAssetGender = "male" | "female";

export type FaceAsset = {
  id: string;
  imagePath: string;
  gender: FaceAssetGender;
};

export const FACE_NAME_MAX_COUNT = 30;

export const FACE_ASSETS: FaceAsset[] = [
  { id: "female-01", imagePath: "/faces/female-01.svg", gender: "female" },
  { id: "female-02", imagePath: "/faces/female-02.svg", gender: "female" },
  { id: "female-03", imagePath: "/faces/female-03.svg", gender: "female" },
  { id: "female-04", imagePath: "/faces/female-04.svg", gender: "female" },
  { id: "female-05", imagePath: "/faces/female-05.svg", gender: "female" },
  { id: "female-06", imagePath: "/faces/female-06.svg", gender: "female" },
  { id: "female-07", imagePath: "/faces/female-07.svg", gender: "female" },
  { id: "female-08", imagePath: "/faces/female-08.svg", gender: "female" },
  { id: "female-09", imagePath: "/faces/female-09.svg", gender: "female" },
  { id: "female-10", imagePath: "/faces/female-10.svg", gender: "female" },
  { id: "female-11", imagePath: "/faces/female-11.svg", gender: "female" },
  { id: "female-12", imagePath: "/faces/female-12.svg", gender: "female" },
  { id: "female-13", imagePath: "/faces/female-13.svg", gender: "female" },
  { id: "female-14", imagePath: "/faces/female-14.svg", gender: "female" },
  { id: "female-15", imagePath: "/faces/female-15.svg", gender: "female" },
  { id: "male-01", imagePath: "/faces/male-01.svg", gender: "male" },
  { id: "male-02", imagePath: "/faces/male-02.svg", gender: "male" },
  { id: "male-03", imagePath: "/faces/male-03.svg", gender: "male" },
  { id: "male-04", imagePath: "/faces/male-04.svg", gender: "male" },
  { id: "male-05", imagePath: "/faces/male-05.svg", gender: "male" },
  { id: "male-06", imagePath: "/faces/male-06.svg", gender: "male" },
  { id: "male-07", imagePath: "/faces/male-07.svg", gender: "male" },
  { id: "male-08", imagePath: "/faces/male-08.svg", gender: "male" },
  { id: "male-09", imagePath: "/faces/male-09.svg", gender: "male" },
  { id: "male-10", imagePath: "/faces/male-10.svg", gender: "male" },
  { id: "male-11", imagePath: "/faces/male-11.svg", gender: "male" },
  { id: "male-12", imagePath: "/faces/male-12.svg", gender: "male" },
  { id: "male-13", imagePath: "/faces/male-13.svg", gender: "male" },
  { id: "male-14", imagePath: "/faces/male-14.svg", gender: "male" },
  { id: "male-15", imagePath: "/faces/male-15.svg", gender: "male" },
];
