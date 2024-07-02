import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { serializeLibraryAsJSON } from "../data/json";
import { t } from "../i18n";
import type {
  ExcalidrawProps,
  LibraryItem,
  LibraryItems,
  UIAppState,
} from "../types";
import { arrayToMap } from "../utils";
import Stack from "./Stack";
import { MIME_TYPES } from "../constants";
import Spinner from "./Spinner";
import { duplicateElements } from "../element/newElement";
import {
  LibraryMenuSection,
  LibraryMenuSectionGrid,
} from "./LibraryMenuSection";
import { useScrollPosition } from "../hooks/useScrollPosition";
import { useLibraryCache } from "../hooks/useLibraryItemSvg";

import "./LibraryMenuItems.scss";

// using an odd number of items per batch so the rendering creates an irregular
// pattern which looks more organic
const ITEMS_RENDERED_PER_BATCH = 17;
// when render outputs cached we can render many more items per batch to
// speed it up
const CACHED_ITEMS_RENDERED_PER_BATCH = 64;

export default function LibraryMenuItems({
  isLoading,
  libraryItems,
  onAddToLibrary,
  onInsertLibraryItems,
  pendingElements,
  theme,
  id,
  libraryReturnUrl,
  onSelectItems,
  selectedItems,
}: {
  isLoading: boolean;
  libraryItems: LibraryItems;
  pendingElements: LibraryItem["elements"];
  onInsertLibraryItems: (libraryItems: LibraryItems) => void;
  onAddToLibrary: (elements: LibraryItem["elements"]) => void;
  libraryReturnUrl: ExcalidrawProps["libraryReturnUrl"];
  theme: UIAppState["theme"];
  id: string;
  selectedItems: LibraryItem["id"][];
  onSelectItems: (id: LibraryItem["id"][]) => void;
}) {
  const libraryContainerRef = useRef<HTMLDivElement>(null);
  const scrollPosition = useScrollPosition<HTMLDivElement>(libraryContainerRef);

  // This effect has to be called only on first render, therefore  `scrollPosition` isn't in the dependency array
  useEffect(() => {
    if (scrollPosition > 0) {
      libraryContainerRef.current?.scrollTo(0, scrollPosition);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const { svgCache } = useLibraryCache();
  const unpublishedItems = useMemo(
    () => libraryItems.filter((item) => item.status !== "published"),
    [libraryItems],
  );

  const [lastSelectedItem, setLastSelectedItem] = useState<
    LibraryItem["id"] | null
  >(null);

  const onItemSelectToggle = useCallback(
    (id: LibraryItem["id"], event: React.MouseEvent) => {
      const shouldSelect = !selectedItems.includes(id);

      if (shouldSelect) {
        if (event.shiftKey && lastSelectedItem) {
          const rangeStart = unpublishedItems.findIndex(
            (item) => item.id === lastSelectedItem,
          );
          const rangeEnd = unpublishedItems.findIndex((item) => item.id === id);

          if (rangeStart === -1 || rangeEnd === -1) {
            onSelectItems([...selectedItems, id]);
            return;
          }

          const selectedItemsMap = arrayToMap(selectedItems);
          const nextSelectedIds = unpublishedItems.reduce(
            (acc: LibraryItem["id"][], item, idx) => {
              if (
                (idx >= rangeStart && idx <= rangeEnd) ||
                selectedItemsMap.has(item.id)
              ) {
                acc.push(item.id);
              }
              return acc;
            },
            [],
          );

          onSelectItems(nextSelectedIds);
        } else {
          onSelectItems([...selectedItems, id]);
        }
        setLastSelectedItem(id);
      } else {
        setLastSelectedItem(null);
        onSelectItems(selectedItems.filter((_id) => _id !== id));
      }
    },
    [lastSelectedItem, onSelectItems, selectedItems, unpublishedItems],
  );

  const getInsertedElements = useCallback(
    (id: string) => {
      let targetElements;
      if (selectedItems.includes(id)) {
        targetElements = libraryItems.filter((item) =>
          selectedItems.includes(item.id),
        );
      } else {
        targetElements = libraryItems.filter((item) => item.id === id);
      }
      return targetElements.map((item) => {
        return {
          ...item,
          // duplicate each library item before inserting on canvas to confine
          // ids and bindings to each library item. See #6465
          elements: duplicateElements(item.elements, { randomizeSeed: true }),
        };
      });
    },
    [libraryItems, selectedItems],
  );

  const onItemDrag = useCallback(
    (id: LibraryItem["id"], event: React.DragEvent) => {
      event.dataTransfer.setData(
        MIME_TYPES.excalidrawlib,
        serializeLibraryAsJSON(getInsertedElements(id)),
      );
    },
    [getInsertedElements],
  );

  const isItemSelected = useCallback(
    (id: LibraryItem["id"] | null) => {
      if (!id) {
        return false;
      }

      return selectedItems.includes(id);
    },
    [selectedItems],
  );

  const onAddToLibraryClick = useCallback(() => {
    onAddToLibrary(pendingElements);
  }, [pendingElements, onAddToLibrary]);

  const onItemClick = useCallback(
    (id: LibraryItem["id"] | null) => {
      if (id) {
        onInsertLibraryItems(getInsertedElements(id));
      }
    },
    [getInsertedElements, onInsertLibraryItems],
  );

  const itemsRenderedPerBatch =
    svgCache.size >= libraryItems.length
      ? CACHED_ITEMS_RENDERED_PER_BATCH
      : ITEMS_RENDERED_PER_BATCH;

  return (
    <div
      className="library-menu-items-container"
      style={{
        justifyContent: "flex-start",
      }}
    >
      <Stack.Col
        align="start"
        className="library-menu-items-container__items"
        gap={1}
        ref={libraryContainerRef}
        style={{
          flex: "0 1 auto",
          marginBottom: 0,
        }}
      >
        <>
          {isLoading && (
            <div
              style={{
                position: "absolute",
                top: "var(--container-padding-y)",
                right: "var(--container-padding-x)",
                transform: "translateY(50%)",
              }}
            >
              <Spinner />
            </div>
          )}
          {!pendingElements.length && !unpublishedItems.length ? (
            <div className="library-menu-items__no-items">
              <div className="library-menu-items__no-items__label">
                {t("library.noItems")}
              </div>
            </div>
          ) : (
            <LibraryMenuSectionGrid>
              {pendingElements.length > 0 && (
                <LibraryMenuSection
                  itemsRenderedPerBatch={itemsRenderedPerBatch}
                  items={[{ id: null, elements: pendingElements }]}
                  onItemSelectToggle={onItemSelectToggle}
                  onItemDrag={onItemDrag}
                  onClick={onAddToLibraryClick}
                  isItemSelected={isItemSelected}
                  svgCache={svgCache}
                />
              )}
              <LibraryMenuSection
                itemsRenderedPerBatch={itemsRenderedPerBatch}
                items={unpublishedItems}
                onItemSelectToggle={onItemSelectToggle}
                onItemDrag={onItemDrag}
                onClick={onItemClick}
                isItemSelected={isItemSelected}
                svgCache={svgCache}
              />
            </LibraryMenuSectionGrid>
          )}
        </>
      </Stack.Col>
    </div>
  );
}
