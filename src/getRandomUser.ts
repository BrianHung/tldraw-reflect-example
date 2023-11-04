import random from "lodash/random"
import { v4 as uuid } from "uuid"

const avatars = [
  ["🐶", "Puppy"],
  ["🐱", "Kitty"],
  ["🐭", "Mouse"],
  ["🐹", "Hamster"],
  ["🐰", "Bunny"],
  ["🦊", "Fox"],
  ["🐻", "Bear"],
  ["🐼", "Panda"],
  ["🐻‍❄️", "Polar Bear"],
  ["🐨", "Koala"],
  ["🐯", "Tiger"],
  ["🦁", "Lion"],
  ["🐮", "Cow"],
  ["🐷", "Piggy"],
  ["🐵", "Monkey"],
  ["🐣", "Chick"],
];

export function getRandomUser() {
  const [avatar, name] = avatars[random(avatars.length - 1)];
  return {
    userId: uuid(),
    name,
    avatar,
  } as const;
}