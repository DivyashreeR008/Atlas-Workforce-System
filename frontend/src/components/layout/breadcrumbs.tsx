"use client";

import { useBreadcrumbs } from "@/hooks/use-breadcrumbs";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Fragment } from "react";

export function Breadcrumbs() {
  const items = useBreadcrumbs();

  if (items.length <= 1) return null;

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {items.map((item, index) => (
          <Fragment key={item.link}>
            {index < items.length - 1 ? (
              <>
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink href={item.link}>{item.title}</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
              </>
            ) : (
              <BreadcrumbPage>{item.title}</BreadcrumbPage>
            )}
          </Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
