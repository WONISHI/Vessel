import { type ButtonProps } from "@/components/ui/button"
import * as React from "react"
export type PaginationLinkProps = { isActive?: boolean } & Pick<ButtonProps, "size"> & React.ComponentProps<"a">
