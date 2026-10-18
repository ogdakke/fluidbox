/// <reference types="vite/client" />
declare module "*.md" {
  const page: import("../markdown").DocModule;
  export default page;
}
